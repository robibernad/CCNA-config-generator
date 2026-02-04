'use client'

import { useEffect, useMemo, useState } from 'react'

interface Interface {
  name: string
  connected: boolean
}

type SwitchType = 'l2' | 'msw'

type VlanSvi = {
  vlanId: number
  ipAddress: string
  subnetMask: string
  description?: string
  shutdown: boolean
}

interface AddressingConfig {
  // Switch management (SVI)
  management?: {
    vlanId: number
    ipAddress: string
    subnetMask: string
    // L2 only
    defaultGateway?: string
    // MSW only
    defaultRouteNextHop?: string
  }

  // Additional SVIs (optional) - mainly useful on MSW (inter-VLAN routing)
  vlanInterfaces: VlanSvi[]

  // Routed interfaces (routers; optional for MSW)
  interfaces: Array<{
    interface: string
    ipAddress: string
    subnetMask: string
    description?: string
    shutdown: boolean
  }>

  // Router-on-a-stick (routers; optional for MSW if you ever use it)
  subinterfaces: Array<{
    parentInterface: string
    vlanId: number
    ipAddress: string
    subnetMask: string
  }>
}

interface Props {
  interfaces: Interface[]
  /** Physical ports already used in switching config (access/trunk/EtherChannel members). */
  usedSwitchPorts?: string[]
  deviceType: string
  switchType?: SwitchType
  config?: AddressingConfig
  onUpdate: (config: AddressingConfig) => void
}

const MASK_OPTIONS = [
  { v: '255.255.255.0', l: '/24 - 255.255.255.0' },
  { v: '255.255.255.128', l: '/25 - 255.255.255.128' },
  { v: '255.255.255.192', l: '/26 - 255.255.255.192' },
  { v: '255.255.255.224', l: '/27 - 255.255.255.224' },
  { v: '255.255.255.240', l: '/28 - 255.255.255.240' },
  { v: '255.255.255.248', l: '/29 - 255.255.255.248' },
  { v: '255.255.255.252', l: '/30 - 255.255.255.252' },
  { v: '255.255.0.0', l: '/16 - 255.255.0.0' },
  { v: '255.0.0.0', l: '/8 - 255.0.0.0' },
]

function defaultConfig(deviceType: string, switchType?: SwitchType): AddressingConfig {
  const isSwitch = deviceType === 'switch'
  const isMsw = isSwitch && switchType === 'msw'

  return {
    management: isSwitch
      ? {
          vlanId: 99,
          ipAddress: '',
          subnetMask: '255.255.255.0',
          defaultGateway: isMsw ? undefined : '',
          defaultRouteNextHop: isMsw ? '' : undefined,
        }
      : undefined,
    vlanInterfaces: [],
    interfaces: [],
    subinterfaces: [],
  }
}

export function AddressingTab({ interfaces, usedSwitchPorts = [], deviceType, switchType, config, onUpdate }: Props) {
  const isSwitch = deviceType === 'switch'
  const isRouter = deviceType === 'router'
  const isMsw = isSwitch && switchType === 'msw'

  const usedSet = useMemo(() => new Set(usedSwitchPorts), [usedSwitchPorts])
  const connectedIfs = useMemo(() => interfaces.filter((i) => i.connected), [interfaces])

  const routedInterfaceOptions = (current?: string) => {
    // Prefer connected interfaces, but fall back to all (some nodes don't report "connected" reliably)
    const pool = (connectedIfs.length > 0 ? connectedIfs : interfaces).filter((i) => !!i.name)
    const options = pool
      .filter((i) => !usedSet.has(i.name) || i.name === current)
      .map((i) => i.name)
    // Ensure current value stays selectable even if it becomes "unavailable"
    if (current && !options.includes(current)) options.unshift(current)
    return options
  }

  const initial = useMemo(() => {
    const base = defaultConfig(deviceType, switchType)

    const merged: AddressingConfig = {
      ...base,
      ...(config || {}),
      vlanInterfaces: config?.vlanInterfaces ?? base.vlanInterfaces,
      interfaces: config?.interfaces ?? base.interfaces,
      subinterfaces: config?.subinterfaces ?? base.subinterfaces,
      management: isSwitch
        ? {
            vlanId: config?.management?.vlanId ?? base.management?.vlanId ?? 99,
            ipAddress: config?.management?.ipAddress ?? base.management?.ipAddress ?? '',
            subnetMask: config?.management?.subnetMask ?? base.management?.subnetMask ?? '255.255.255.0',
            defaultGateway: isMsw
              ? undefined
              : (config?.management?.defaultGateway ?? base.management?.defaultGateway ?? ''),
            defaultRouteNextHop: isMsw
              ? (config?.management?.defaultRouteNextHop ?? base.management?.defaultRouteNextHop ?? '')
              : undefined,
          }
        : undefined,
    }

    // harden arrays
    merged.vlanInterfaces = Array.isArray(merged.vlanInterfaces) ? merged.vlanInterfaces : []
    merged.interfaces = Array.isArray(merged.interfaces) ? merged.interfaces : []
    merged.subinterfaces = Array.isArray(merged.subinterfaces) ? merged.subinterfaces : []

    return merged
  }, [config, deviceType, isMsw, isSwitch, switchType])

  const [localConfig, setLocalConfig] = useState<AddressingConfig>(initial)

  useEffect(() => {
    setLocalConfig(initial)
  }, [initial])

  const pushUpdate = (next: AddressingConfig) => {
    setLocalConfig(next)
    onUpdate(next)
  }

  // --- Switch management handlers
  const updateMgmt = (field: keyof NonNullable<AddressingConfig['management']>, value: any) => {
    const mgmt = localConfig.management ?? {
      vlanId: 99,
      ipAddress: '',
      subnetMask: '255.255.255.0',
      ...(isMsw ? { defaultRouteNextHop: '' } : { defaultGateway: '' }),
    }

    const nextMgmt: any = { ...mgmt, [field]: value }

    // Force required strings (avoid undefined creeping in)
    nextMgmt.ipAddress = typeof nextMgmt.ipAddress === 'string' ? nextMgmt.ipAddress : ''
    nextMgmt.subnetMask = typeof nextMgmt.subnetMask === 'string' ? nextMgmt.subnetMask : '255.255.255.0'
    nextMgmt.vlanId = Number.isFinite(nextMgmt.vlanId) ? Number(nextMgmt.vlanId) : 99

    // enforce L2/MSW specific fields
    if (isMsw) {
      delete nextMgmt.defaultGateway
      nextMgmt.defaultRouteNextHop = typeof nextMgmt.defaultRouteNextHop === 'string' ? nextMgmt.defaultRouteNextHop : ''
    } else {
      delete nextMgmt.defaultRouteNextHop
      nextMgmt.defaultGateway = typeof nextMgmt.defaultGateway === 'string' ? nextMgmt.defaultGateway : ''
    }

    pushUpdate({ ...localConfig, management: nextMgmt })
  }

  // --- Additional SVIs (VLAN interfaces)
  const addVlanInterface = () => {
    const next: AddressingConfig = {
      ...localConfig,
      vlanInterfaces: [
        ...(localConfig.vlanInterfaces || []),
        {
          vlanId: 10,
          ipAddress: '',
          subnetMask: '255.255.255.0',
          shutdown: false,
        },
      ],
    }
    pushUpdate(next)
  }

  const updateVlanInterface = (index: number, field: keyof VlanSvi, value: any) => {
    const updated = [...(localConfig.vlanInterfaces || [])]
    const cur = updated[index] ?? {
      vlanId: 10,
      ipAddress: '',
      subnetMask: '255.255.255.0',
      shutdown: false,
    }

    const next: VlanSvi = {
      ...cur,
      [field]: value,
      vlanId: Number.isFinite(Number((field === 'vlanId' ? value : cur.vlanId) ?? 10))
        ? Number(field === 'vlanId' ? value : cur.vlanId)
        : 10,
      ipAddress: typeof (field === 'ipAddress' ? value : cur.ipAddress) === 'string'
        ? String(field === 'ipAddress' ? value : cur.ipAddress)
        : '',
      subnetMask: typeof (field === 'subnetMask' ? value : cur.subnetMask) === 'string'
        ? String(field === 'subnetMask' ? value : cur.subnetMask)
        : '255.255.255.0',
      shutdown: Boolean(field === 'shutdown' ? value : cur.shutdown),
    }

    updated[index] = next
    pushUpdate({ ...localConfig, vlanInterfaces: updated })
  }

  const removeVlanInterface = (index: number) => {
    const updated = (localConfig.vlanInterfaces || []).filter((_, i) => i !== index)
    pushUpdate({ ...localConfig, vlanInterfaces: updated })
  }

  // --- Routed interface handlers (routers; optional for MSW)
  const addInterface = () => {
    // Only allow adding a routed interface that is available (not already used elsewhere).
    const opts = routedInterfaceOptions()
    const alreadyUsed = new Set((localConfig.interfaces || []).map((i) => i.interface))
    // opts is an array of interface names (strings)
    const firstAvailable = opts.find((i) => !alreadyUsed.has(i))
    if (!firstAvailable) return

    const newConfig: AddressingConfig = {
      ...localConfig,
      interfaces: [
        ...localConfig.interfaces,
        {
          interface: firstAvailable,
          ipAddress: '',
          subnetMask: '255.255.255.0',
          shutdown: false,
        },
      ],
    }
    pushUpdate(newConfig)
  }

  const updateInterface = (index: number, field: string, value: any) => {
    const updated = [...localConfig.interfaces]
    updated[index] = { ...updated[index], [field]: value }
    pushUpdate({ ...localConfig, interfaces: updated })
  }

  const removeInterface = (index: number) => {
    const updated = localConfig.interfaces.filter((_, i) => i !== index)
    pushUpdate({ ...localConfig, interfaces: updated })
  }

  const mgmtVlanId = localConfig.management?.vlanId ?? 99

  return (
    <div className="space-y-8">
      {/* SWITCH: Management SVI */}
      {isSwitch && (
        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">Management (SVI)</h3>
            <span className="text-xs text-slate-500">
              {isMsw ? 'MSW: uses routing (default route optional)' : 'L2: uses ip default-gateway'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Management VLAN</label>
              <input
                type="number"
                min={1}
                max={4094}
                value={localConfig.management?.vlanId ?? 99}
                onChange={(e) => updateMgmt('vlanId', Number(e.target.value || 99))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">Default: 99</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Management IP</label>
              <input
                type="text"
                value={localConfig.management?.ipAddress ?? ''}
                onChange={(e) => updateMgmt('ipAddress', e.target.value)}
                placeholder="192.168.99.2"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Subnet Mask</label>
              <select
                value={localConfig.management?.subnetMask ?? '255.255.255.0'}
                onChange={(e) => updateMgmt('subnetMask', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                {MASK_OPTIONS.map((m) => (
                  <option key={m.v} value={m.v}>
                    {m.l}
                  </option>
                ))}
              </select>
            </div>

            <div>
              {!isMsw ? (
                <>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Default Gateway</label>
                  <input
                    type="text"
                    value={localConfig.management?.defaultGateway ?? ''}
                    onChange={(e) => updateMgmt('defaultGateway', e.target.value)}
                    placeholder="192.168.99.1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">Generated as: ip default-gateway</p>
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Default Route Next-hop <span className="text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={localConfig.management?.defaultRouteNextHop ?? ''}
                    onChange={(e) => updateMgmt('defaultRouteNextHop', e.target.value)}
                    placeholder="192.168.99.1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">Generated as: ip route 0.0.0.0/0</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SWITCH: Additional SVIs */}
      {isSwitch && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">VLAN Interfaces (SVIs) <span className="text-slate-400 text-sm">(optional)</span></h3>
              <p className="text-xs text-slate-500 mt-1">
                {isMsw
                  ? 'Use this for inter-VLAN routing (interface VlanX).'
                  : 'On L2 switches, SVIs are typically for management only. Use carefully.'}
              </p>
            </div>
            <button
              onClick={addVlanInterface}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
            >
              + Add VLAN SVI
            </button>
          </div>

          {localConfig.vlanInterfaces.length === 0 ? (
            <div className="text-center py-6 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
              No additional SVIs configured.
            </div>
          ) : (
            <div className="space-y-3">
              {localConfig.vlanInterfaces.map((svi, idx) => {
                const isSameAsMgmt = svi.vlanId === mgmtVlanId
                return (
                  <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">VLAN ID</label>
                        <input
                          type="number"
                          min={1}
                          max={4094}
                          value={svi.vlanId}
                          onChange={(e) => updateVlanInterface(idx, 'vlanId', Number(e.target.value || 1))}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                        {isSameAsMgmt && (
                          <p className="text-xs text-amber-600 mt-1">
                            Note: same VLAN as Management (VLAN {mgmtVlanId})
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">IP Address</label>
                        <input
                          type="text"
                          value={svi.ipAddress}
                          onChange={(e) => updateVlanInterface(idx, 'ipAddress', e.target.value)}
                          placeholder="192.168.10.1"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Subnet Mask</label>
                        <select
                          value={svi.subnetMask}
                          onChange={(e) => updateVlanInterface(idx, 'subnetMask', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        >
                          {MASK_OPTIONS.map((m) => (
                            <option key={m.v} value={m.v}>
                              {m.l}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-end">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={!svi.shutdown}
                            onChange={(e) => updateVlanInterface(idx, 'shutdown', !e.target.checked)}
                            className="rounded"
                          />
                          Enabled
                        </label>
                      </div>

                      <div className="flex items-end">
                        <button
                          onClick={() => removeVlanInterface(idx)}
                          className="ml-auto px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Description (optional)</label>
                      <input
                        type="text"
                        value={svi.description || ''}
                        onChange={(e) => updateVlanInterface(idx, 'description', e.target.value)}
                        placeholder="Users VLAN SVI"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ROUTER (and optional MSW): Routed Interface Addressing */}
      {(isRouter || isMsw) && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">
              {isRouter ? 'Interface Addressing' : 'Routed Interfaces (optional)'}
            </h3>
            <button
              onClick={addInterface}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              + Add Interface
            </button>
          </div>

          {localConfig.interfaces.length === 0 ? (
            <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
              No routed interfaces configured.
            </div>
          ) : (
            <div className="space-y-4">
              {localConfig.interfaces.map((iface, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Interface</label>
                      <select
                        value={iface.interface}
                        onChange={(e) => updateInterface(index, 'interface', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      >
                        {routedInterfaceOptions(iface.interface).map((i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">IP Address</label>
                      <input
                        type="text"
                        value={iface.ipAddress}
                        onChange={(e) => updateInterface(index, 'ipAddress', e.target.value)}
                        placeholder="192.168.1.1"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Subnet Mask</label>
                      <select
                        value={iface.subnetMask}
                        onChange={(e) => updateInterface(index, 'subnetMask', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      >
                        {MASK_OPTIONS.map((m) => (
                          <option key={m.v} value={m.v}>
                            {m.l}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!iface.shutdown}
                          onChange={(e) => updateInterface(index, 'shutdown', !e.target.checked)}
                          className="rounded"
                        />
                        Enabled
                      </label>
                      <button
                        onClick={() => removeInterface(index)}
                        className="ml-auto px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block text-sm font-medium text-slate-600 mb-1">Description (optional)</label>
                    <input
                      type="text"
                      value={iface.description || ''}
                      onChange={(e) => updateInterface(index, 'description', e.target.value)}
                      placeholder="Connection to Core"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
