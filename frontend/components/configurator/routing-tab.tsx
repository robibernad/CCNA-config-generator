import { useMemo, useState } from 'react'

interface Interface {
  name: string
  connected: boolean
}

interface DefaultRoute {
  nextHop?: string
  exitInterface?: string
  distance?: number
}

interface StaticRoute {
  destination: string
  subnetMask: string
  nextHop?: string
  exitInterface?: string
  distance?: number
  name?: string
}

interface OspfNetwork {
  network: string
  wildcard: string
  area: number
}

interface OspfInterface {
  interface: string
  area: number
  cost?: number
  priority?: number
}

interface OspfConfig {
  processId: number
  routerId?: string
  networks: OspfNetwork[]
  passiveInterfaces: string[]
  defaultOriginate: boolean
  interfaces: OspfInterface[]
}

interface EigrpNetwork {
  network: string
  wildcard?: string
}

interface EigrpConfig {
  enabled: boolean
  asn: number
  routerId?: string
  noAutoSummary: boolean
  networks: EigrpNetwork[]
  passiveInterfaces: string[]
}

interface GreTunnel {
  tunnelNumber: number
  sourceInterface: string
  destinationIp: string
  tunnelIp: string
  tunnelMask: string
  mtu?: number
  adjustMss?: number
  tunnelKey?: number
  keepaliveSeconds?: number
  keepaliveRetries?: number
}

interface RoutingConfig {
  defaultRoute?: DefaultRoute | null
  staticRoutes?: StaticRoute[]
  ospf?: OspfConfig | null
  eigrp?: EigrpConfig | null
  greTunnels?: GreTunnel[]
}

interface Props {
  interfaces: Interface[]
  /** Physical ports already used in switching config (access/trunk/EtherChannel members). */
  usedSwitchPorts?: string[]
  config?: RoutingConfig
  onUpdate: (config: RoutingConfig) => void
}

function nOrUndef(v: string): number | undefined {
  const t = v.trim()
  if (t === '') return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

export function RoutingTab({ interfaces, usedSwitchPorts = [], config, onUpdate }: Props) {
  const defaultConfig: RoutingConfig = {
    defaultRoute: null,
    staticRoutes: [],
    ospf: null,
    eigrp: { enabled: false, asn: 100, noAutoSummary: true, networks: [], passiveInterfaces: [] },
    greTunnels: [],
  }

  const [routingConfig, setRoutingConfig] = useState<RoutingConfig>(config || defaultConfig)

  const usedSet = useMemo(() => new Set(usedSwitchPorts), [usedSwitchPorts])
  const connectedIfs = useMemo(() => interfaces.filter((i) => i.connected), [interfaces])

  const interfaceOptions = useMemo(() => {
    const base = connectedIfs
      .map((i) => i.name)
      .filter((name) => !usedSet.has(name))
      .sort((a, b) => a.localeCompare(b))
    return base
  }, [connectedIfs, usedSet])

  const optionsWithCurrent = (current?: string) => {
    const opts = [...interfaceOptions]
    if (current && !opts.includes(current)) opts.unshift(current)
    return opts
  }

  const updateConfig = (updates: Partial<RoutingConfig>) => {
    const newConfig = { ...routingConfig, ...updates }
    setRoutingConfig(newConfig)
    onUpdate(newConfig)
  }

  // ---------------- Default route ----------------
  const toggleDefaultRoute = (enabled: boolean) => {
    if (!enabled) return updateConfig({ defaultRoute: null })
    updateConfig({ defaultRoute: { nextHop: '' } })
  }

  // ---------------- Static routes ----------------
  const addStaticRoute = () => {
    const routes = routingConfig.staticRoutes || []
    updateConfig({
      staticRoutes: [
        ...routes,
        { destination: '', subnetMask: '255.255.255.0', nextHop: '', exitInterface: '', distance: undefined, name: '' },
      ],
    })
  }

  const updateStaticRoute = (idx: number, field: keyof StaticRoute, value: any) => {
    const routes = [...(routingConfig.staticRoutes || [])]
    routes[idx] = { ...routes[idx], [field]: value }
    updateConfig({ staticRoutes: routes })
  }

  const removeStaticRoute = (idx: number) => {
    updateConfig({ staticRoutes: (routingConfig.staticRoutes || []).filter((_, i) => i !== idx) })
  }

  // ---------------- OSPF ----------------
  const toggleOspf = (enabled: boolean) => {
    if (!enabled) return updateConfig({ ospf: null })
    updateConfig({
      ospf: {
        processId: 1,
        routerId: '',
        networks: [],
        passiveInterfaces: [],
        defaultOriginate: false,
        interfaces: [],
      },
    })
  }

  const addOspfNetwork = () => {
    const ospf = routingConfig.ospf
    if (!ospf) return
    updateConfig({ ospf: { ...ospf, networks: [...ospf.networks, { network: '', wildcard: '', area: 0 }] } })
  }

  const updateOspfNetwork = (idx: number, field: keyof OspfNetwork, value: any) => {
    const ospf = routingConfig.ospf
    if (!ospf) return
    const networks = [...ospf.networks]
    networks[idx] = { ...networks[idx], [field]: value }
    updateConfig({ ospf: { ...ospf, networks } })
  }

  const removeOspfNetwork = (idx: number) => {
    const ospf = routingConfig.ospf
    if (!ospf) return
    updateConfig({ ospf: { ...ospf, networks: ospf.networks.filter((_, i) => i !== idx) } })
  }

  const addOspfInterface = () => {
    const ospf = routingConfig.ospf
    if (!ospf) return
    updateConfig({ ospf: { ...ospf, interfaces: [...ospf.interfaces, { interface: '', area: 0 }] } })
  }

  const updateOspfInterface = (idx: number, field: keyof OspfInterface, value: any) => {
    const ospf = routingConfig.ospf
    if (!ospf) return
    const ifaces = [...ospf.interfaces]
    ifaces[idx] = { ...ifaces[idx], [field]: value }
    updateConfig({ ospf: { ...ospf, interfaces: ifaces } })
  }

  const removeOspfInterface = (idx: number) => {
    const ospf = routingConfig.ospf
    if (!ospf) return
    updateConfig({ ospf: { ...ospf, interfaces: ospf.interfaces.filter((_, i) => i !== idx) } })
  }

  const toggleOspfPassive = (ifaceName: string) => {
    const ospf = routingConfig.ospf
    if (!ospf) return
    const set = new Set(ospf.passiveInterfaces || [])
    if (set.has(ifaceName)) set.delete(ifaceName)
    else set.add(ifaceName)
    updateConfig({ ospf: { ...ospf, passiveInterfaces: Array.from(set).sort() } })
  }

  // ---------------- EIGRP ----------------
  const toggleEigrp = (enabled: boolean) => {
    const eigrp = routingConfig.eigrp || {
      enabled: false,
      asn: 100,
      routerId: '',
      noAutoSummary: true,
      networks: [],
      passiveInterfaces: [],
    }
    updateConfig({ eigrp: { ...eigrp, enabled } })
  }

  const addEigrpNetwork = () => {
    const eigrp = routingConfig.eigrp
    if (!eigrp) return
    updateConfig({ eigrp: { ...eigrp, networks: [...(eigrp.networks || []), { network: '', wildcard: '' }] } })
  }

  const updateEigrpNetwork = (idx: number, field: keyof EigrpNetwork, value: any) => {
    const eigrp = routingConfig.eigrp
    if (!eigrp) return
    const networks = [...(eigrp.networks || [])]
    networks[idx] = { ...networks[idx], [field]: value }
    updateConfig({ eigrp: { ...eigrp, networks } })
  }

  const removeEigrpNetwork = (idx: number) => {
    const eigrp = routingConfig.eigrp
    if (!eigrp) return
    updateConfig({ eigrp: { ...eigrp, networks: (eigrp.networks || []).filter((_, i) => i !== idx) } })
  }

  const toggleEigrpPassive = (ifaceName: string) => {
    const eigrp = routingConfig.eigrp
    if (!eigrp) return
    const set = new Set(eigrp.passiveInterfaces || [])
    if (set.has(ifaceName)) set.delete(ifaceName)
    else set.add(ifaceName)
    updateConfig({ eigrp: { ...eigrp, passiveInterfaces: Array.from(set).sort() } })
  }

  // ---------------- VPN (GRE) ----------------
  const addGreTunnel = () => {
    const tunnels = routingConfig.greTunnels || []
    const nextNumber = tunnels.length > 0 ? Math.max(...tunnels.map((t) => t.tunnelNumber || 0)) + 1 : 0
    updateConfig({
      greTunnels: [
        ...tunnels,
        {
          tunnelNumber: nextNumber,
          sourceInterface: '',
          destinationIp: '',
          tunnelIp: '',
          tunnelMask: '255.255.255.252',
          mtu: undefined,
          adjustMss: undefined,
          tunnelKey: undefined,
          keepaliveSeconds: undefined,
          keepaliveRetries: undefined,
        },
      ],
    })
  }

  const updateGreTunnel = (idx: number, field: keyof GreTunnel, value: any) => {
    const tunnels = [...(routingConfig.greTunnels || [])]
    tunnels[idx] = { ...tunnels[idx], [field]: value }
    updateConfig({ greTunnels: tunnels })
  }

  const removeGreTunnel = (idx: number) => {
    updateConfig({ greTunnels: (routingConfig.greTunnels || []).filter((_, i) => i !== idx) })
  }

  return (
    <div className="space-y-6">
      {/* Default Route */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Default Route</h3>
            <p className="text-sm text-slate-600">Configure a default route (0.0.0.0/0).</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!routingConfig.defaultRoute}
              onChange={(e) => toggleDefaultRoute(e.target.checked)}
            />
            Enable
          </label>
        </div>

        {routingConfig.defaultRoute && (
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Next Hop</label>
              <input
                type="text"
                value={routingConfig.defaultRoute.nextHop || ''}
                onChange={(e) => updateConfig({ defaultRoute: { ...routingConfig.defaultRoute!, nextHop: e.target.value } })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                placeholder="e.g. 203.0.113.1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Exit Interface (optional)</label>
              <select
                value={routingConfig.defaultRoute.exitInterface || ''}
                onChange={(e) => updateConfig({ defaultRoute: { ...routingConfig.defaultRoute!, exitInterface: e.target.value } })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">—</option>
                {optionsWithCurrent(routingConfig.defaultRoute.exitInterface).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Distance (optional)</label>
              <input
                type="number"
                value={routingConfig.defaultRoute.distance ?? ''}
                onChange={(e) => updateConfig({ defaultRoute: { ...routingConfig.defaultRoute!, distance: nOrUndef(e.target.value) } })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                placeholder="1-255"
                min={1}
                max={255}
              />
            </div>
          </div>
        )}
      </div>

      {/* Static Routes */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Static Routes</h3>
            <p className="text-sm text-slate-600">Add static routes for specific networks.</p>
          </div>
          <button
            type="button"
            onClick={addStaticRoute}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Add Route
          </button>
        </div>

        <div className="space-y-4">
          {(routingConfig.staticRoutes || []).map((r, idx) => (
            <div key={idx} className="border border-slate-200 rounded-lg p-4">
              <div className="grid md:grid-cols-6 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Destination</label>
                  <input
                    type="text"
                    value={r.destination}
                    onChange={(e) => updateStaticRoute(idx, 'destination', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="e.g. 10.10.0.0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Mask</label>
                  <input
                    type="text"
                    value={r.subnetMask}
                    onChange={(e) => updateStaticRoute(idx, 'subnetMask', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="255.255.255.0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Next Hop</label>
                  <input
                    type="text"
                    value={r.nextHop || ''}
                    onChange={(e) => updateStaticRoute(idx, 'nextHop', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="e.g. 192.0.2.1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Exit Iface</label>
                  <select
                    value={r.exitInterface || ''}
                    onChange={(e) => updateStaticRoute(idx, 'exitInterface', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="">—</option>
                    {optionsWithCurrent(r.exitInterface).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Distance</label>
                  <input
                    type="number"
                    value={r.distance ?? ''}
                    onChange={(e) => updateStaticRoute(idx, 'distance', nOrUndef(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="optional"
                    min={1}
                    max={255}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Name (optional)</label>
                  <input
                    type="text"
                    value={r.name || ''}
                    onChange={(e) => updateStaticRoute(idx, 'name', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="e.g. TO_ISP"
                  />
                </div>

                <div className="md:col-span-2 flex items-end justify-end">
                  <button
                    type="button"
                    onClick={() => removeStaticRoute(idx)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}

          {(routingConfig.staticRoutes || []).length === 0 && (
            <p className="text-sm text-slate-500">No static routes configured.</p>
          )}
        </div>
      </div>

      {/* OSPF */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">OSPF</h3>
            <p className="text-sm text-slate-600">Configure OSPF routing protocol.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!routingConfig.ospf} onChange={(e) => toggleOspf(e.target.checked)} />
            Enable
          </label>
        </div>

        {routingConfig.ospf && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Process ID</label>
                <input
                  type="number"
                  value={routingConfig.ospf.processId}
                  onChange={(e) => updateConfig({ ospf: { ...routingConfig.ospf!, processId: Number(e.target.value) } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  min={1}
                  max={65535}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Router ID (optional)</label>
                <input
                  type="text"
                  value={routingConfig.ospf.routerId || ''}
                  onChange={(e) => updateConfig({ ospf: { ...routingConfig.ospf!, routerId: e.target.value } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="e.g. 1.1.1.1"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={routingConfig.ospf.defaultOriginate}
                    onChange={(e) => updateConfig({ ospf: { ...routingConfig.ospf!, defaultOriginate: e.target.checked } })}
                  />
                  Default Originate
                </label>
              </div>
            </div>

            {/* OSPF Networks */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-md font-semibold text-slate-900">Networks</h4>
                <button
                  type="button"
                  onClick={addOspfNetwork}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Add Network
                </button>
              </div>

              <div className="space-y-3">
                {routingConfig.ospf.networks.map((n, idx) => (
                  <div key={idx} className="grid md:grid-cols-5 gap-3 items-end p-3 border border-slate-200 rounded-lg">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Network</label>
                      <input
                        type="text"
                        value={n.network}
                        onChange={(e) => updateOspfNetwork(idx, 'network', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        placeholder="e.g. 10.0.0.0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Wildcard</label>
                      <input
                        type="text"
                        value={n.wildcard}
                        onChange={(e) => updateOspfNetwork(idx, 'wildcard', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        placeholder="0.0.0.255"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Area</label>
                      <input
                        type="number"
                        value={n.area}
                        onChange={(e) => updateOspfNetwork(idx, 'area', Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        min={0}
                      />
                    </div>
                    <div className="flex justify-end">
                      <button type="button" onClick={() => removeOspfNetwork(idx)} className="text-red-600 text-sm">
                        Remove
                      </button>
                    </div>
                  </div>
                ))}

                {routingConfig.ospf.networks.length === 0 && (
                  <p className="text-sm text-slate-500">No OSPF networks configured.</p>
                )}
              </div>
            </div>

            {/* OSPF Interface bindings */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-md font-semibold text-slate-900">Interfaces</h4>
                <button
                  type="button"
                  onClick={addOspfInterface}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Add Interface
                </button>
              </div>

              <div className="space-y-3">
                {routingConfig.ospf.interfaces.map((iCfg, idx) => (
                  <div key={idx} className="grid md:grid-cols-6 gap-3 items-end p-3 border border-slate-200 rounded-lg">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Interface</label>
                      <select
                        value={iCfg.interface}
                        onChange={(e) => updateOspfInterface(idx, 'interface', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      >
                        <option value="">Select interface</option>
                        {optionsWithCurrent(iCfg.interface).map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Area</label>
                      <input
                        type="number"
                        value={iCfg.area}
                        onChange={(e) => updateOspfInterface(idx, 'area', Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        min={0}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Cost</label>
                      <input
                        type="number"
                        value={iCfg.cost ?? ''}
                        onChange={(e) => updateOspfInterface(idx, 'cost', nOrUndef(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        min={1}
                        placeholder="optional"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Priority</label>
                      <input
                        type="number"
                        value={iCfg.priority ?? ''}
                        onChange={(e) => updateOspfInterface(idx, 'priority', nOrUndef(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        min={0}
                        max={255}
                        placeholder="optional"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button type="button" onClick={() => removeOspfInterface(idx)} className="text-red-600 text-sm">
                        Remove
                      </button>
                    </div>
                  </div>
                ))}

                {routingConfig.ospf.interfaces.length === 0 && (
                  <p className="text-sm text-slate-500">No OSPF interfaces configured.</p>
                )}
              </div>
            </div>

            {/* Passive interfaces */}
            <div>
              <h4 className="text-md font-semibold text-slate-900 mb-2">Passive Interfaces</h4>
              <p className="text-sm text-slate-600 mb-3">Select interfaces that should not form OSPF adjacencies.</p>

              <div className="flex flex-wrap gap-2">
                {optionsWithCurrent(undefined).map((name) => (
                  <button
                    type="button"
                    key={name}
                    onClick={() => toggleOspfPassive(name)}
                    className={`px-3 py-1 rounded-full text-sm border ${
                      (routingConfig.ospf!.passiveInterfaces || []).includes(name)
                        ? 'bg-blue-50 border-blue-300 text-blue-800'
                        : 'bg-white border-slate-300 text-slate-700'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* EIGRP */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">EIGRP</h3>
            <p className="text-sm text-slate-600">Optional: configure EIGRP (classic, CCNA-level).</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!routingConfig.eigrp?.enabled}
              onChange={(e) => toggleEigrp(e.target.checked)}
            />
            Enable
          </label>
        </div>

        {routingConfig.eigrp?.enabled && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ASN</label>
                <input
                  type="number"
                  value={routingConfig.eigrp.asn}
                  onChange={(e) => updateConfig({ eigrp: { ...routingConfig.eigrp!, asn: Number(e.target.value) } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  min={1}
                  max={65535}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Router ID (optional)</label>
                <input
                  type="text"
                  value={routingConfig.eigrp.routerId || ''}
                  onChange={(e) => updateConfig({ eigrp: { ...routingConfig.eigrp!, routerId: e.target.value } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="e.g. 2.2.2.2"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={routingConfig.eigrp.noAutoSummary}
                    onChange={(e) => updateConfig({ eigrp: { ...routingConfig.eigrp!, noAutoSummary: e.target.checked } })}
                  />
                  No Auto Summary
                </label>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-md font-semibold text-slate-900">Networks</h4>
                <button
                  type="button"
                  onClick={addEigrpNetwork}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                >
                  Add Network
                </button>
              </div>

              <div className="space-y-3">
                {(routingConfig.eigrp.networks || []).map((n, idx) => (
                  <div key={idx} className="grid md:grid-cols-5 gap-3 items-end p-3 border border-slate-200 rounded-lg">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Network</label>
                      <input
                        type="text"
                        value={n.network}
                        onChange={(e) => updateEigrpNetwork(idx, 'network', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        placeholder="e.g. 10.0.0.0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Wildcard (optional)</label>
                      <input
                        type="text"
                        value={n.wildcard || ''}
                        onChange={(e) => updateEigrpNetwork(idx, 'wildcard', e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        placeholder="e.g. 0.0.0.255"
                      />
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                      <button type="button" onClick={() => removeEigrpNetwork(idx)} className="text-red-600 text-sm">
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {(routingConfig.eigrp.networks || []).length === 0 && (
                  <p className="text-sm text-slate-500">No EIGRP networks configured.</p>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-md font-semibold text-slate-900 mb-2">Passive Interfaces</h4>
              <div className="flex flex-wrap gap-2">
                {optionsWithCurrent(undefined).map((name) => (
                  <button
                    type="button"
                    key={name}
                    onClick={() => toggleEigrpPassive(name)}
                    className={`px-3 py-1 rounded-full text-sm border ${
                      (routingConfig.eigrp!.passiveInterfaces || []).includes(name)
                        ? 'bg-blue-50 border-blue-300 text-blue-800'
                        : 'bg-white border-slate-300 text-slate-700'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* VPN (GRE) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">VPN (GRE Tunnels)</h3>
            <p className="text-sm text-slate-600">Configure GRE tunnels (common CCNA-style VPN lab).</p>
          </div>
          <button
            type="button"
            onClick={addGreTunnel}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Add Tunnel
          </button>
        </div>

        <div className="space-y-4">
          {(routingConfig.greTunnels || []).map((t, idx) => (
            <div key={idx} className="border border-slate-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-slate-900">Tunnel {t.tunnelNumber}</h4>
                <button type="button" onClick={() => removeGreTunnel(idx)} className="text-red-600 text-sm">
                  Remove
                </button>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tunnel Number</label>
                  <input
                    type="number"
                    value={t.tunnelNumber}
                    onChange={(e) => updateGreTunnel(idx, 'tunnelNumber', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Source Interface</label>
                  <select
                    value={t.sourceInterface}
                    onChange={(e) => updateGreTunnel(idx, 'sourceInterface', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="">Select interface</option>
                    {optionsWithCurrent(t.sourceInterface).map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Destination IP</label>
                  <input
                    type="text"
                    value={t.destinationIp}
                    onChange={(e) => updateGreTunnel(idx, 'destinationIp', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="e.g. 198.51.100.2"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-4 mt-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tunnel IP</label>
                  <input
                    type="text"
                    value={t.tunnelIp}
                    onChange={(e) => updateGreTunnel(idx, 'tunnelIp', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="e.g. 10.255.255.1"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tunnel Mask</label>
                  <input
                    type="text"
                    value={t.tunnelMask}
                    onChange={(e) => updateGreTunnel(idx, 'tunnelMask', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="255.255.255.252"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-5 gap-4 mt-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">MTU</label>
                  <input
                    type="number"
                    value={t.mtu ?? ''}
                    onChange={(e) => updateGreTunnel(idx, 'mtu', nOrUndef(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="optional"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Adjust MSS</label>
                  <input
                    type="number"
                    value={t.adjustMss ?? ''}
                    onChange={(e) => updateGreTunnel(idx, 'adjustMss', nOrUndef(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="optional"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tunnel Key</label>
                  <input
                    type="number"
                    value={t.tunnelKey ?? ''}
                    onChange={(e) => updateGreTunnel(idx, 'tunnelKey', nOrUndef(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="optional"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Keepalive (sec)</label>
                  <input
                    type="number"
                    value={t.keepaliveSeconds ?? ''}
                    onChange={(e) => updateGreTunnel(idx, 'keepaliveSeconds', nOrUndef(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="optional"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Keepalive Retries</label>
                  <input
                    type="number"
                    value={t.keepaliveRetries ?? ''}
                    onChange={(e) => updateGreTunnel(idx, 'keepaliveRetries', nOrUndef(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="optional"
                  />
                </div>
              </div>
            </div>
          ))}

          {(routingConfig.greTunnels || []).length === 0 && (
            <p className="text-sm text-slate-500">No GRE tunnels configured.</p>
          )}
        </div>
      </div>
    </div>
  )
}
