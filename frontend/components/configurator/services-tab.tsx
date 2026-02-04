'use client'

import { useEffect, useMemo, useState } from 'react'

type SwitchType = 'l2' | 'msw'

interface Props {
  interfaces: Array<{ name: string; connected: boolean }>
  /** Physical ports already used in switching config (access/trunk/EtherChannel members). */
  usedSwitchPorts?: string[]
  deviceType: string
  switchType?: SwitchType
  config?: any
  onUpdate: (config: any) => void
}

function normalizeConfig(input: any) {
  return (
    input || {
      hsrp: [],
      dhcpExclusions: [],
      dhcpPools: [],
      nat: null,
    }
  )
}

export function ServicesTab({ interfaces, usedSwitchPorts = [], deviceType, switchType, config, onUpdate }: Props) {
  const initial = useMemo(() => normalizeConfig(config), [config])
  const [localConfig, setLocalConfig] = useState(initial)

  useEffect(() => {
    setLocalConfig(initial)
  }, [initial])

  const isSwitch = deviceType === 'switch'
  const isL2Switch = isSwitch && (switchType === 'l2' || !switchType) // safe default: treat as L2 unless explicit msw
  const isMsw = isSwitch && switchType === 'msw'
  const canDoL3Services = deviceType === 'router' || isMsw

  const usedSet = useMemo(() => new Set(usedSwitchPorts), [usedSwitchPorts])
  const connectedIfs = useMemo(() => interfaces.filter((i) => i.connected), [interfaces])

  const interfaceOptions = useMemo(() => {
    // Prefer connected interfaces, but fall back to all if the backend doesn't mark connectivity.
    const base = (connectedIfs.length > 0 ? connectedIfs : interfaces)
      .map((i) => i.name)
      .filter(Boolean)

    // Filter out interfaces already used for L2 switching (access/trunk/EC members)
    const free = base.filter((name) => !usedSet.has(name))
    return [...new Set(free.length > 0 ? free : base)]
  }, [connectedIfs, interfaces, usedSet])

  const getInterfaceOptions = (current?: string) => {
    // Ensure the currently selected interface remains selectable (even if it becomes "used").
    const opts = [...interfaceOptions]
    if (current && current.trim() !== '' && !opts.includes(current)) {
      opts.unshift(current)
    }
    return opts
  }

  const push = (next: any) => {
    setLocalConfig(next)
    onUpdate(next)
  }

  const addHsrp = () => {
    const next = {
      ...localConfig,
      hsrp: [
        ...(localConfig.hsrp || []),
        {
          interface: interfaceOptions[0] || interfaces[0]?.name || '',
          group: 1,
          virtualIp: '',
          priority: 100,
          preempt: true,
        },
      ],
    }
    push(next)
  }

  const updateHsrp = (index: number, patch: any) => {
    const updated = [...(localConfig.hsrp || [])]
    updated[index] = { ...updated[index], ...patch }
    push({ ...localConfig, hsrp: updated })
  }

  const removeHsrp = (index: number) => {
    const updated = (localConfig.hsrp || []).filter((_: any, i: number) => i !== index)
    push({ ...localConfig, hsrp: updated })
  }

  const addDhcpPool = () => {
    const next = {
      ...localConfig,
      dhcpPools: [
        ...(localConfig.dhcpPools || []),
        {
          name: 'POOL1',
          network: '',
          mask: '255.255.255.0',
          defaultGateway: '',
          dnsServers: [],
          leaseDays: 1,
        },
      ],
    }
    push(next)
  }

  const updateDhcpPool = (index: number, patch: any) => {
    const updated = [...(localConfig.dhcpPools || [])]
    updated[index] = { ...updated[index], ...patch }
    push({ ...localConfig, dhcpPools: updated })
  }

  const removeDhcpPool = (index: number) => {
    const updated = (localConfig.dhcpPools || []).filter((_: any, i: number) => i !== index)
    push({ ...localConfig, dhcpPools: updated })
  }

  // ---------------- NAT ----------------
  const toggleNat = (enabled: boolean) => {
    if (!enabled) {
      push({ ...localConfig, nat: null })
      return
    }
    push({
      ...localConfig,
      nat: {
        insideInterfaces: [],
        outsideInterfaces: [],
        staticEntries: [],
        pools: [],
        patInterface: '',
        patAcl: '',
      },
    })
  }

  const updateNat = (patch: any) => {
    push({ ...localConfig, nat: { ...(localConfig.nat || {}), ...patch } })
  }

  const addNatInterface = (kind: 'insideInterfaces' | 'outsideInterfaces') => {
    const existing = (localConfig.nat?.[kind] || []) as string[]
    updateNat({ [kind]: [...existing, ''] })
  }

  const updateNatInterface = (kind: 'insideInterfaces' | 'outsideInterfaces', index: number, value: string) => {
    const arr = [...((localConfig.nat?.[kind] || []) as string[])]
    arr[index] = value
    updateNat({ [kind]: arr })
  }

  const removeNatInterface = (kind: 'insideInterfaces' | 'outsideInterfaces', index: number) => {
    const arr = [...((localConfig.nat?.[kind] || []) as string[])]
    arr.splice(index, 1)
    updateNat({ [kind]: arr })
  }

  const addNatStatic = () => {
    const current = (localConfig.nat?.staticEntries || []) as any[]
    updateNat({ staticEntries: [...current, { insideLocal: '', insideGlobal: '' }] })
  }

  const updateNatStatic = (index: number, patch: any) => {
    const arr = [...((localConfig.nat?.staticEntries || []) as any[])]
    arr[index] = { ...arr[index], ...patch }
    updateNat({ staticEntries: arr })
  }

  const removeNatStatic = (index: number) => {
    const arr = [...((localConfig.nat?.staticEntries || []) as any[])]
    arr.splice(index, 1)
    updateNat({ staticEntries: arr })
  }

  const addNatPool = () => {
    const current = (localConfig.nat?.pools || []) as any[]
    updateNat({
      pools: [...current, { name: `POOL${current.length + 1}`, startIp: '', endIp: '', netmask: '255.255.255.0' }],
    })
  }

  const updateNatPool = (index: number, patch: any) => {
    const arr = [...((localConfig.nat?.pools || []) as any[])]
    arr[index] = { ...arr[index], ...patch }
    updateNat({ pools: arr })
  }

  const removeNatPool = (index: number) => {
    const arr = [...((localConfig.nat?.pools || []) as any[])]
    arr.splice(index, 1)
    updateNat({ pools: arr })
  }

  return (
    <div className="space-y-8">
      {/* Info / Guard */}
      {isL2Switch && (
        <div className="p-4 rounded-lg border border-amber-200 bg-amber-50">
          <div className="font-semibold text-amber-800">ℹ️ L2 Switch</div>
          <div className="text-sm text-amber-700 mt-1">
            Services like <strong>HSRP</strong> and <strong>DHCP</strong> are Layer-3 features. Select an{' '}
            <strong>MSW</strong> (multilayer switch) or a <strong>router</strong> to configure them.
          </div>
        </div>
      )}

      {/* HSRP */}
      <div className={canDoL3Services ? '' : 'opacity-60'}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">HSRP (Hot Standby Router Protocol)</h3>
          <button
            onClick={addHsrp}
            disabled={!canDoL3Services}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add HSRP Group
          </button>
        </div>

        {(localConfig.hsrp || []).length === 0 ? (
          <div className="text-center py-6 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
            No HSRP configured
          </div>
        ) : (
          <div className="space-y-4">
            {(localConfig.hsrp || []).map((hsrp: any, index: number) => (
              <div key={index} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Interface</label>
                    <select
                      value={hsrp.interface}
                      disabled={!canDoL3Services}
                      onChange={(e) => updateHsrp(index, { interface: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:cursor-not-allowed"
                    >
                      {getInterfaceOptions(hsrp.interface).map((i) => (
                        <option key={i} value={i}>
                          {i}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Group</label>
                    <input
                      type="number"
                      value={hsrp.group}
                      disabled={!canDoL3Services}
                      onChange={(e) => updateHsrp(index, { group: parseInt(e.target.value || '1', 10) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Virtual IP</label>
                    <input
                      type="text"
                      value={hsrp.virtualIp}
                      disabled={!canDoL3Services}
                      onChange={(e) => updateHsrp(index, { virtualIp: e.target.value })}
                      placeholder="192.168.1.1"
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Priority</label>
                    <input
                      type="number"
                      value={hsrp.priority}
                      disabled={!canDoL3Services}
                      onChange={(e) => updateHsrp(index, { priority: parseInt(e.target.value || '100', 10) })}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!hsrp.preempt}
                      disabled={!canDoL3Services}
                      onChange={(e) => updateHsrp(index, { preempt: e.target.checked })}
                      className="rounded disabled:cursor-not-allowed"
                    />
                    Preempt
                  </label>

                  <button
                    onClick={() => removeHsrp(index)}
                    disabled={!canDoL3Services}
                    className="text-red-600 hover:bg-red-100 px-2 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DHCP Pools */}
      <div className={canDoL3Services ? '' : 'opacity-60'}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">DHCP Pools</h3>
          <button
            onClick={addDhcpPool}
            disabled={!canDoL3Services}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add DHCP Pool
          </button>
        </div>

        {(localConfig.dhcpPools || []).length === 0 ? (
          <div className="text-center py-6 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
            No DHCP pools configured
          </div>
        ) : (
          <div className="space-y-4">
            {(localConfig.dhcpPools || []).map((pool: any, index: number) => (
              <div key={index} className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Pool Name</label>
                    <input
                      type="text"
                      value={pool.name}
                      disabled={!canDoL3Services}
                      onChange={(e) => updateDhcpPool(index, { name: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Network</label>
                    <input
                      type="text"
                      value={pool.network}
                      disabled={!canDoL3Services}
                      onChange={(e) => updateDhcpPool(index, { network: e.target.value })}
                      placeholder="192.168.1.0"
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Default Gateway</label>
                    <input
                      type="text"
                      value={pool.defaultGateway || ''}
                      disabled={!canDoL3Services}
                      onChange={(e) => updateDhcpPool(index, { defaultGateway: e.target.value })}
                      placeholder="192.168.1.1"
                      className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <button
                  onClick={() => removeDhcpPool(index)}
                  disabled={!canDoL3Services}
                  className="mt-3 text-red-600 hover:bg-red-100 px-2 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Remove Pool
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NAT (router edge feature) */}
      {deviceType === 'router' && (
      <div className={canDoL3Services ? '' : 'opacity-60'}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">NAT</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={!canDoL3Services}
              checked={!!localConfig.nat}
              onChange={(e) => toggleNat(e.target.checked)}
              className="rounded disabled:cursor-not-allowed"
            />
            Enable NAT
          </label>
        </div>

        {!localConfig.nat ? (
          <div className="text-center py-6 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
            NAT is disabled
          </div>
        ) : (
          <div className="space-y-4">
            {/* Inside / Outside Interfaces */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-slate-800">Inside Interfaces</label>
                    <button
                      onClick={() => addNatInterface('inside')}
                      disabled={!canDoL3Services}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                    >
                      + Add
                    </button>
                  </div>
                  {(localConfig.nat.insideInterfaces || []).length === 0 ? (
                    <div className="text-sm text-slate-500">None</div>
                  ) : (
                    <div className="space-y-2">
                      {(localConfig.nat.insideInterfaces || []).map((iface: string, idx: number) => (
                        <div key={`in-${idx}`} className="flex gap-2 items-center">
                          <select
                            value={iface}
                            disabled={!canDoL3Services}
                            onChange={(e) => updateNatInterface('inside', idx, e.target.value)}
                            className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm disabled:cursor-not-allowed"
                          >
                            {getInterfaceOptions(iface).map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => removeNatInterface('inside', idx)}
                            disabled={!canDoL3Services}
                            className="text-red-600 hover:bg-red-100 px-2 py-1 rounded text-xs disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-slate-800">Outside Interfaces</label>
                    <button
                      onClick={() => addNatInterface('outside')}
                      disabled={!canDoL3Services}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                    >
                      + Add
                    </button>
                  </div>
                  {(localConfig.nat.outsideInterfaces || []).length === 0 ? (
                    <div className="text-sm text-slate-500">None</div>
                  ) : (
                    <div className="space-y-2">
                      {(localConfig.nat.outsideInterfaces || []).map((iface: string, idx: number) => (
                        <div key={`out-${idx}`} className="flex gap-2 items-center">
                          <select
                            value={iface}
                            disabled={!canDoL3Services}
                            onChange={(e) => updateNatInterface('outside', idx, e.target.value)}
                            className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm disabled:cursor-not-allowed"
                          >
                            {getInterfaceOptions(iface).map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => removeNatInterface('outside', idx)}
                            disabled={!canDoL3Services}
                            className="text-red-600 hover:bg-red-100 px-2 py-1 rounded text-xs disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Static NAT */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-800">Static NAT Entries</label>
                <button
                  onClick={addNatStatic}
                  disabled={!canDoL3Services}
                  className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                >
                  + Add
                </button>
              </div>
              {(localConfig.nat.staticEntries || []).length === 0 ? (
                <div className="text-sm text-slate-500">None</div>
              ) : (
                <div className="space-y-2">
                  {(localConfig.nat.staticEntries || []).map((st: any, idx: number) => (
                    <div key={`st-${idx}`} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                      <input
                        type="text"
                        value={st.insideLocal || ''}
                        disabled={!canDoL3Services}
                        onChange={(e) => updateNatStatic(idx, { insideLocal: e.target.value })}
                        placeholder="inside local (e.g., 192.168.10.10)"
                        className="px-3 py-2 border border-slate-300 rounded text-sm disabled:cursor-not-allowed"
                      />
                      <input
                        type="text"
                        value={st.insideGlobal || ''}
                        disabled={!canDoL3Services}
                        onChange={(e) => updateNatStatic(idx, { insideGlobal: e.target.value })}
                        placeholder="inside global (e.g., 203.0.113.10)"
                        className="px-3 py-2 border border-slate-300 rounded text-sm disabled:cursor-not-allowed"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={() => removeNatStatic(idx)}
                          disabled={!canDoL3Services}
                          className="text-red-600 hover:bg-red-100 px-2 py-1 rounded text-xs disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* NAT Pools */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-800">NAT Pools</label>
                <button
                  onClick={addNatPool}
                  disabled={!canDoL3Services}
                  className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                >
                  + Add
                </button>
              </div>
              {(localConfig.nat.pools || []).length === 0 ? (
                <div className="text-sm text-slate-500">None</div>
              ) : (
                <div className="space-y-3">
                  {(localConfig.nat.pools || []).map((pool: any, idx: number) => (
                    <div key={`pool-${idx}`} className="p-3 border border-slate-200 rounded bg-white">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <input
                          type="text"
                          value={pool.name || ''}
                          disabled={!canDoL3Services}
                          onChange={(e) => updateNatPool(idx, { name: e.target.value })}
                          placeholder="POOL_NAME"
                          className="px-3 py-2 border border-slate-300 rounded text-sm disabled:cursor-not-allowed"
                        />
                        <input
                          type="text"
                          value={pool.startIp || ''}
                          disabled={!canDoL3Services}
                          onChange={(e) => updateNatPool(idx, { startIp: e.target.value })}
                          placeholder="start IP"
                          className="px-3 py-2 border border-slate-300 rounded text-sm disabled:cursor-not-allowed"
                        />
                        <input
                          type="text"
                          value={pool.endIp || ''}
                          disabled={!canDoL3Services}
                          onChange={(e) => updateNatPool(idx, { endIp: e.target.value })}
                          placeholder="end IP"
                          className="px-3 py-2 border border-slate-300 rounded text-sm disabled:cursor-not-allowed"
                        />
                        <input
                          type="text"
                          value={pool.netmask || ''}
                          disabled={!canDoL3Services}
                          onChange={(e) => updateNatPool(idx, { netmask: e.target.value })}
                          placeholder="netmask (e.g., 255.255.255.0)"
                          className="px-3 py-2 border border-slate-300 rounded text-sm disabled:cursor-not-allowed"
                        />
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button
                          onClick={() => removeNatPool(idx)}
                          disabled={!canDoL3Services}
                          className="text-red-600 hover:bg-red-100 px-2 py-1 rounded text-xs disabled:opacity-50"
                        >
                          Remove pool
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PAT */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <label className="text-sm font-semibold text-slate-800">PAT (Overload)</label>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">PAT Interface</label>
                  <select
                    value={localConfig.nat.patInterface || ''}
                    disabled={!canDoL3Services}
                    onChange={(e) => updateNatPat({ patInterface: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:cursor-not-allowed"
                  >
                            {getInterfaceOptions(localConfig.nat.patInterface || '').map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">PAT ACL (standard/extended name or number)</label>
                  <input
                    type="text"
                    value={localConfig.nat.patAcl || ''}
                    disabled={!canDoL3Services}
                    onChange={(e) => updateNatPat({ patAcl: e.target.value })}
                    placeholder="ACL name/number"
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:cursor-not-allowed"
                  />
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Tip: For overload NAT you typically need <code>insideInterfaces</code>, <code>outsideInterfaces</code>,
                a PAT interface, and an ACL.
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
