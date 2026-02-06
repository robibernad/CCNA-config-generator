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
  vrf?: string
}

interface RoutedInterface {
  interface: string
  ipAddress: string
  subnetMask: string
  description?: string
  shutdown: boolean
  vrf?: string
  cryptoMap?: string
  mplsIp?: boolean // MPLS IP support
  duplex?: string  // IPsec Router: full, half, auto
  speed?: string   // IPsec Router: 10, 100, 1000, auto
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
  interfaces: RoutedInterface[]

  // Router-on-a-stick
  subinterfaces: Array<{
    parentInterface: string
    vlanId: number
    ipAddress: string
    subnetMask: string
    vrf?: string
  }>
}

type DeviceType = 'switch' | 'router' | 'router-ipsec' | 'nat' | 'cloud'

interface Props {
  interfaces: Interface[]
  /** Physical ports already used in switching config (access/trunk/EtherChannel members). */
  usedSwitchPorts?: string[]
  deviceType: DeviceType
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
  { v: '255.255.255.255', l: '/32 - 255.255.255.255' },
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
          vrf: '',
        },
      ],
    }
    pushUpdate(next)
  }

  const updateVlanInterface = (index: number, field: keyof VlanSvi, value: any) => {
    const updated = [...(localConfig.vlanInterfaces || [])]
    const cur = updated[index]
    const next: VlanSvi = { ...cur, [field]: value }
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
          vrf: '',
          cryptoMap: '',
          mplsIp: false, // NEW: default to false
        },
      ],
    }
    pushUpdate(newConfig)
  }

  const addLoopback = () => {
    const currentLoopbacks = localConfig.interfaces
      .map((i) => i.interface)
      .filter((n) => n.toLowerCase().startsWith('loopback'))
    
    // Find first available Loopback number
    let nextId = 0
    while (currentLoopbacks.some(n => n.toLowerCase() === `loopback${nextId}`)) {
        nextId++
    }

    const newConfig: AddressingConfig = {
        ...localConfig,
        interfaces: [
          ...localConfig.interfaces,
          {
            interface: `Loopback${nextId}`,
            ipAddress: '',
            subnetMask: '255.255.255.255',
            shutdown: false,
            description: 'Loopback Interface',
            vrf: '',
            mplsIp: false, // NEW: default to false
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
                          <div className="w-full">
                            <label className="block text-xs font-medium text-slate-600 mb-1">VRF</label>
                            <input
                              type="text"
                              value={svi.vrf || ''}
                              onChange={(e) => updateVlanInterface(idx, 'vrf', e.target.value)}
                              placeholder="e.g. MGMT"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            />
                          </div>
                      </div>

                      <div className="flex items-end justify-between">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={!svi.shutdown}
                            onChange={(e) => updateVlanInterface(idx, 'shutdown', !e.target.checked)}
                            className="rounded"
                          />
                          Enabled
                        </label>
                        <button
                          onClick={() => removeVlanInterface(idx)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
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
            <div className="flex gap-2">
                <button
                onClick={addLoopback}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                >
                + Add Loopback
                </button>
                <button
                onClick={addInterface}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                + Add Interface
                </button>
            </div>
          </div>

          {localConfig.interfaces.length === 0 ? (
            <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
              No routed interfaces configured.
            </div>
          ) : (
            <div className="space-y-4">
              {localConfig.interfaces.map((iface, index) => {
                  const isLoopback = iface.interface.toLowerCase().startsWith('loopback');
                  return (
                <div key={index} className={`border rounded-lg p-4 ${isLoopback ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1">Interface</label>
                      {isLoopback ? (
                          <input 
                            type="text"
                            value={iface.interface}
                            disabled
                            className="w-full px-3 py-2 border border-indigo-200 bg-indigo-100 text-indigo-800 rounded-lg text-sm font-bold"
                          />
                      ) : (
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
                      )}
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

                    <div className="flex items-end gap-2 justify-between">
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
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3">
                      <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-slate-600 mb-1">Description (optional)</label>
                        <input
                            type="text"
                            value={iface.description || ''}
                            onChange={(e) => updateInterface(index, 'description', e.target.value)}
                            placeholder="Connection to Core"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">VRF (optional)</label>
                        <input
                            type="text"
                            value={iface.vrf || ''}
                            onChange={(e) => updateInterface(index, 'vrf', e.target.value)}
                            placeholder="e.g. CUST_A"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                       <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Crypto Map (VPN)</label>
                        <input
                            type="text"
                            value={iface.cryptoMap || ''}
                            onChange={(e) => updateInterface(index, 'cryptoMap', e.target.value)}
                            placeholder="e.g. MY_VPN_MAP"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      {/* NEW: MPLS IP Checkbox */}
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={iface.mplsIp || false}
                            onChange={(e) => updateInterface(index, 'mplsIp', e.target.checked)}
                            className="rounded"
                          />
                          <span className="text-slate-700">Enable MPLS IP</span>
                        </label>
                      </div>
                  </div>

                  {/* IPsec Router Specific Settings */}
                  {deviceType === 'router-ipsec' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Duplex (IPsec Router)</label>
                        <select
                          value={iface.duplex || ''}
                          onChange={(e) => updateInterface(index, 'duplex', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        >
                          <option value="">Auto</option>
                          <option value="full">Full</option>
                          <option value="half">Half</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-1">Speed (IPsec Router)</label>
                        <select
                          value={iface.speed || ''}
                          onChange={(e) => updateInterface(index, 'speed', e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        >
                          <option value="">Auto</option>
                          <option value="10">10 Mbps</option>
                          <option value="100">100 Mbps</option>
                          <option value="1000">1000 Mbps</option>
                        </select>
                      </div>
                      <div className="col-span-2 text-xs text-yellow-700">
                        ⚠️ <strong>IPsec Router:</strong> This device type requires explicit duplex/speed settings for stability.
                      </div>
                    </div>
                  )}

                  {/* Help text for MPLS */}
                  {iface.mplsIp && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                      💡 <strong>MPLS IP enabled:</strong> This interface will participate in MPLS label distribution (typically used on PE router core-facing interfaces).
                    </div>
                  )}
                </div>
              )})}
            </div>
          )}
        </div>
      )}
    </div>
  )
}