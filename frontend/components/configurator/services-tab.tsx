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
  context?: 'router' | 'nat' // New prop received from device-configurator
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

export function ServicesTab({ interfaces, usedSwitchPorts = [], deviceType, switchType, config, onUpdate, context = 'router' }: Props) {
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
    return Array.from(new Set(free.length > 0 ? free : base))
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

  // --- HSRP/DHCP Handlers (Router Context) ---

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

  const addDhcpExclusion = () => {
    const next = {
      ...localConfig,
      dhcpExclusions: [
        ...(localConfig.dhcpExclusions || []),
        {
          start: '',
          end: '',
        },
      ],
    }
    push(next)
  }

  const updateDhcpExclusion = (index: number, patch: any) => {
    const updated = [...(localConfig.dhcpExclusions || [])]
    updated[index] = { ...updated[index], ...patch }
    push({ ...localConfig, dhcpExclusions: updated })
  }

  const removeDhcpExclusion = (index: number) => {
    const updated = (localConfig.dhcpExclusions || []).filter((_: any, i: number) => i !== index)
    push({ ...localConfig, dhcpExclusions: updated })
  }

  // --- NAT Handlers (NAT Context) ---
  
  // Ensure NAT object exists if we are in NAT context
  useEffect(() => {
      if (context === 'nat' && !localConfig.nat) {
          push({
            ...localConfig,
            nat: {
                insideInterfaces: [],
                outsideInterfaces: [],
                staticEntries: [],
                pools: [],
                patInterface: '',
                patAcl: '',
            }
          })
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context])


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

  // ==============================================================================
  // RENDER: Router Context (HSRP & DHCP)
  // ==============================================================================
  if (context === 'router') {
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

            {/* DHCP Exclusions */}
            <div className={canDoL3Services ? '' : 'opacity-60'}>
                <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">DHCP Excluded Addresses</h3>
                <button
                    onClick={addDhcpExclusion}
                    disabled={!canDoL3Services}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    + Add Exclusion
                </button>
                </div>

                {(localConfig.dhcpExclusions || []).length === 0 ? (
                <div className="text-center py-6 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
                    No DHCP exclusions configured
                </div>
                ) : (
                <div className="space-y-4">
                    {(localConfig.dhcpExclusions || []).map((excl: any, index: number) => (
                    <div key={index} className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Start IP</label>
                            <input
                            type="text"
                            value={excl.start}
                            disabled={!canDoL3Services}
                            onChange={(e) => updateDhcpExclusion(index, { start: e.target.value })}
                            placeholder="192.168.1.1"
                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-slate-500 mb-1">End IP (optional, same as start for single IP)</label>
                            <input
                            type="text"
                            value={excl.end || ''}
                            disabled={!canDoL3Services}
                            onChange={(e) => updateDhcpExclusion(index, { end: e.target.value })}
                            placeholder="192.168.1.10"
                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:cursor-not-allowed"
                            />
                        </div>
                        </div>

                        <button
                        onClick={() => removeDhcpExclusion(index)}
                        disabled={!canDoL3Services}
                        className="mt-3 text-red-600 hover:bg-red-100 px-2 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                        Remove Exclusion
                        </button>
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
                    <div key={index} className="p-4 bg-green-50 rounded-lg border border-green-200 space-y-4">
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
                            <label className="block text-xs text-slate-500 mb-1">Subnet Mask</label>
                            <input
                            type="text"
                            value={pool.mask || ''}
                            disabled={!canDoL3Services}
                            onChange={(e) => updateDhcpPool(index, { mask: e.target.value })}
                            placeholder="255.255.255.0"
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

                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Domain Name</label>
                            <input
                            type="text"
                            value={pool.domainName || ''}
                            disabled={!canDoL3Services}
                            onChange={(e) => updateDhcpPool(index, { domainName: e.target.value })}
                            placeholder="example.com"
                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-slate-500 mb-1">Lease (days)</label>
                            <input
                            type="number"
                            value={pool.leaseDays || 1}
                            disabled={!canDoL3Services}
                            onChange={(e) => updateDhcpPool(index, { leaseDays: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:cursor-not-allowed"
                            />
                        </div>
                        </div>

                        <div>
                            <label className="block text-xs text-slate-500 mb-1">DNS Servers (comma-separated)</label>
                            <input
                            type="text"
                            value={(pool.dnsServers || []).join(', ')}
                            disabled={!canDoL3Services}
                            onChange={(e) => updateDhcpPool(index, { dnsServers: e.target.value.split(',').map((s: string) => s.trim()).filter((s: string) => s) })}
                            placeholder="8.8.8.8, 8.8.4.4"
                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm disabled:cursor-not-allowed"
                            />
                        </div>

                        <button
                        onClick={() => removeDhcpPool(index)}
                        disabled={!canDoL3Services}
                        className="text-red-600 hover:bg-red-100 px-2 py-1 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                        Remove Pool
                        </button>
                    </div>
                    ))}
                </div>
                )}
            </div>
        </div>
    )
  }

  // ==============================================================================
  // RENDER: NAT Context (NAT Only)
  // ==============================================================================
  return (
    <div className="space-y-8">
        <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">NAT Configuration</h3>
                <p className="text-sm text-slate-500">Configure Network Address Translation for this Gateway/Cloud device.</p>
            </div>

            {/* Inside / Outside Interfaces */}
            <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Inside Interfaces */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-semibold text-slate-800">Inside Interfaces</label>
                                <button onClick={() => addNatInterface('insideInterfaces')} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">+ Add Interface</button>
                            </div>
                            <div className="space-y-2">
                                {(localConfig.nat?.insideInterfaces || []).map((iface: string, idx: number) => (
                                    <div key={`in-${idx}`} className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={iface} 
                                            onChange={(e) => updateNatInterface('insideInterfaces', idx, e.target.value)}
                                            placeholder="e.g. GigabitEthernet0/1"
                                            className="flex-1 px-3 py-2 border rounded text-sm"
                                        />
                                        <button onClick={() => removeNatInterface('insideInterfaces', idx)} className="text-red-500 hover:bg-red-50 px-2 rounded">×</button>
                                    </div>
                                ))}
                                {(localConfig.nat?.insideInterfaces || []).length === 0 && <p className="text-xs text-slate-400 italic">No inside interfaces defined.</p>}
                            </div>
                        </div>

                        {/* Outside Interfaces */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-semibold text-slate-800">Outside Interfaces</label>
                                <button onClick={() => addNatInterface('outsideInterfaces')} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">+ Add Interface</button>
                            </div>
                            <div className="space-y-2">
                                {(localConfig.nat?.outsideInterfaces || []).map((iface: string, idx: number) => (
                                    <div key={`out-${idx}`} className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={iface} 
                                            onChange={(e) => updateNatInterface('outsideInterfaces', idx, e.target.value)}
                                            placeholder="e.g. GigabitEthernet0/0"
                                            className="flex-1 px-3 py-2 border rounded text-sm"
                                        />
                                        <button onClick={() => removeNatInterface('outsideInterfaces', idx)} className="text-red-500 hover:bg-red-50 px-2 rounded">×</button>
                                    </div>
                                ))}
                                {(localConfig.nat?.outsideInterfaces || []).length === 0 && <p className="text-xs text-slate-400 italic">No outside interfaces defined.</p>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Static NAT */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-slate-800">Static NAT Entries</label>
                        <button onClick={addNatStatic} className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">+ Add Static Entry</button>
                    </div>
                    <div className="space-y-2">
                        {(localConfig.nat?.staticEntries || []).map((st: any, idx: number) => (
                            <div key={`st-${idx}`} className="grid grid-cols-1 md:grid-cols-7 gap-2 items-center bg-white p-2 rounded border border-slate-200">
                                <div className="md:col-span-3">
                                    <label className="block text-[10px] text-slate-500">Inside Local IP</label>
                                    <input type="text" value={st.insideLocal} onChange={(e) => updateNatStatic(idx, { insideLocal: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" placeholder="192.168.10.5" />
                                </div>
                                <div className="md:col-span-1 text-center text-slate-400">➔</div>
                                <div className="md:col-span-3">
                                    <label className="block text-[10px] text-slate-500">Inside Global IP</label>
                                    <input type="text" value={st.insideGlobal} onChange={(e) => updateNatStatic(idx, { insideGlobal: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" placeholder="203.0.113.5" />
                                </div>
                                <button onClick={() => removeNatStatic(idx)} className="text-red-500 hover:text-red-700 ml-2">Remove</button>
                            </div>
                        ))}
                         {(localConfig.nat?.staticEntries || []).length === 0 && <p className="text-xs text-slate-400 italic">No static NAT entries.</p>}
                    </div>
                </div>

                {/* PAT / Overload */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <h4 className="text-sm font-semibold text-slate-800 mb-3">PAT (Overload) Configuration</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Overload Interface</label>
                            <input 
                                type="text" 
                                value={localConfig.nat?.patInterface || ''} 
                                onChange={(e) => updateNat({ patInterface: e.target.value })} 
                                placeholder="e.g. GigabitEthernet0/0"
                                className="w-full px-3 py-2 border rounded text-sm" 
                            />
                            <p className="text-[10px] text-slate-500 mt-1">Interface connected to the ISP.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Match ACL</label>
                            <input 
                                type="text" 
                                value={localConfig.nat?.patAcl || ''} 
                                onChange={(e) => updateNat({ patAcl: e.target.value })} 
                                placeholder="e.g. NAT_ACL"
                                className="w-full px-3 py-2 border rounded text-sm" 
                            />
                            <p className="text-[10px] text-slate-500 mt-1">ACL defining traffic allowed to be translated.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  )
}