import { useMemo, useState } from 'react'

interface Interface {
  name: string
  connected: boolean
}

// --- Basic Routing Models ---

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
  vrf?: string // New: VRF support
}

// --- Dynamic Routing Models ---

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
  vrf?: string // New: VRF support
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

interface BGPNeighbor {
  ip: string
  remoteAs: number
  updateSource?: string
  nextHopSelf?: boolean
  activateVpnv4?: boolean // New: MPLS/VPN support
}

interface BGPConfig {
  asn: number
  routerId?: string
  neighbors: BGPNeighbor[]
  networks: string[]
}

// --- Advanced Features ---

interface VRFConfig {
  name: string
  rd: string
  routeTargetExport?: string
  routeTargetImport?: string
  description?: string
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
  ipsecProfile?: string // New: Link to Crypto Map/Profile
}

interface RoutingConfig {
  defaultRoute?: DefaultRoute | null
  staticRoutes?: StaticRoute[]
  ospf?: OspfConfig | null
  eigrp?: EigrpConfig | null
  bgp?: BGPConfig | null
  greTunnels?: GreTunnel[]
  vrfs?: VRFConfig[]
  redistributeEnabled?: boolean
  redistributeMetric?: string
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
    eigrp: null,
    bgp: null,
    greTunnels: [],
    vrfs: [],
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

  // --- Helpers for VRF Dropdowns ---
  const vrfOptions = useMemo(() => {
    return (routingConfig.vrfs || []).map(v => v.name);
  }, [routingConfig.vrfs]);


  // ---------------- VRF Logic ----------------
  const addVrf = () => {
    const vrfs = routingConfig.vrfs || []
    updateConfig({
      vrfs: [
        ...vrfs,
        { name: `VRF${vrfs.length + 1}`, rd: '100:1', routeTargetExport: '', routeTargetImport: '' }
      ]
    })
  }

  const updateVrf = (idx: number, field: keyof VRFConfig, value: string) => {
    const vrfs = [...(routingConfig.vrfs || [])]
    vrfs[idx] = { ...vrfs[idx], [field]: value }
    updateConfig({ vrfs })
  }

  const removeVrf = (idx: number) => {
    updateConfig({ vrfs: (routingConfig.vrfs || []).filter((_, i) => i !== idx) })
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
        { destination: '', subnetMask: '255.255.255.0', nextHop: '', exitInterface: '', distance: undefined, name: '', vrf: '' },
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
        vrf: ''
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
    if (!enabled) return updateConfig({ eigrp: null })
    updateConfig({
      eigrp: {
        enabled: true,
        asn: 100,
        routerId: '',
        noAutoSummary: true,
        networks: [],
        passiveInterfaces: [],
      },
    })
  }

  const addEigrpNetwork = () => {
    const eigrp = routingConfig.eigrp
    if (!eigrp) return
    updateConfig({ eigrp: { ...eigrp, networks: [...eigrp.networks, { network: '', wildcard: '' }] } })
  }

  const updateEigrpNetwork = (idx: number, field: keyof EigrpNetwork, value: any) => {
    const eigrp = routingConfig.eigrp
    if (!eigrp) return
    const networks = [...eigrp.networks]
    networks[idx] = { ...networks[idx], [field]: value }
    updateConfig({ eigrp: { ...eigrp, networks } })
  }

  const removeEigrpNetwork = (idx: number) => {
    const eigrp = routingConfig.eigrp
    if (!eigrp) return
    updateConfig({ eigrp: { ...eigrp, networks: eigrp.networks.filter((_, i) => i !== idx) } })
  }

  const toggleEigrpPassive = (ifaceName: string) => {
    const eigrp = routingConfig.eigrp
    if (!eigrp) return
    const set = new Set(eigrp.passiveInterfaces || [])
    if (set.has(ifaceName)) set.delete(ifaceName)
    else set.add(ifaceName)
    updateConfig({ eigrp: { ...eigrp, passiveInterfaces: Array.from(set).sort() } })
  }

  // ---------------- BGP Logic ----------------
  const toggleBgp = (enabled: boolean) => {
    if (!enabled) return updateConfig({ bgp: null })
    updateConfig({
        bgp: {
            asn: 65000,
            routerId: '',
            neighbors: [],
            networks: []
        }
    })
  }

  const addBgpNeighbor = () => {
    const bgp = routingConfig.bgp
    if (!bgp) return
    updateConfig({ bgp: { ...bgp, neighbors: [...bgp.neighbors, { ip: '', remoteAs: 65000, nextHopSelf: false, activateVpnv4: false }] } })
  }

  const updateBgpNeighbor = (idx: number, field: keyof BGPNeighbor, value: any) => {
    const bgp = routingConfig.bgp
    if (!bgp) return
    const neighbors = [...bgp.neighbors]
    neighbors[idx] = { ...neighbors[idx], [field]: value }
    updateConfig({ bgp: { ...bgp, neighbors } })
  }

  const removeBgpNeighbor = (idx: number) => {
    const bgp = routingConfig.bgp
    if (!bgp) return
    updateConfig({ bgp: { ...bgp, neighbors: bgp.neighbors.filter((_, i) => i !== idx) } })
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
          mtu: 1400,
          adjustMss: 1360,
          tunnelKey: undefined,
          keepaliveSeconds: 10,
          keepaliveRetries: 3,
          ipsecProfile: '' // New field
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

      {/* --- VRF Configuration --- */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">VRF Configuration</h3>
            <p className="text-sm text-slate-600">Define Virtual Routing and Forwarding instances (VRF-Lite/MPLS).</p>
          </div>
          <button type="button" onClick={addVrf} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            Add VRF
          </button>
        </div>
        <div className="space-y-4">
           {(routingConfig.vrfs || []).map((vrf, idx) => (
             <div key={idx} className="grid md:grid-cols-5 gap-3 items-end p-3 border border-slate-200 rounded-lg bg-slate-50">
               <div>
                  <label className="block text-xs font-medium text-slate-700">Name</label>
                  <input type="text" value={vrf.name} onChange={(e) => updateVrf(idx, 'name', e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="e.g. CUSTOMER_A" />
               </div>
               <div>
                  <label className="block text-xs font-medium text-slate-700">RD</label>
                  <input type="text" value={vrf.rd} onChange={(e) => updateVrf(idx, 'rd', e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="100:1" />
               </div>
               <div>
                  <label className="block text-xs font-medium text-slate-700">Export RT</label>
                  <input type="text" value={vrf.routeTargetExport || ''} onChange={(e) => updateVrf(idx, 'routeTargetExport', e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="100:1" />
               </div>
               <div>
                  <label className="block text-xs font-medium text-slate-700">Import RT</label>
                  <input type="text" value={vrf.routeTargetImport || ''} onChange={(e) => updateVrf(idx, 'routeTargetImport', e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="100:1" />
               </div>
               <div>
                  <button type="button" onClick={() => removeVrf(idx)} className="text-red-600 text-sm hover:underline">Remove</button>
               </div>
             </div>
           ))}
           {(routingConfig.vrfs || []).length === 0 && <p className="text-sm text-slate-400 italic">No VRFs defined.</p>}
        </div>
      </div>

      {/* --- Default Route --- */}
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Exit Interface</label>
              <select
                value={routingConfig.defaultRoute.exitInterface || ''}
                onChange={(e) => updateConfig({ defaultRoute: { ...routingConfig.defaultRoute!, exitInterface: e.target.value } })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">—</option>
                {optionsWithCurrent(routingConfig.defaultRoute.exitInterface).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* --- Static Routes --- */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Static Routes</h3>
            <p className="text-sm text-slate-600">Add static routes for specific networks.</p>
          </div>
          <button type="button" onClick={addStaticRoute} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            Add Route
          </button>
        </div>

        <div className="space-y-4">
          {(routingConfig.staticRoutes || []).map((r, idx) => (
            <div key={idx} className="border border-slate-200 rounded-lg p-4">
              <div className="grid md:grid-cols-6 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Destination</label>
                  <input type="text" value={r.destination} onChange={(e) => updateStaticRoute(idx, 'destination', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="10.10.0.0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Mask</label>
                  <input type="text" value={r.subnetMask} onChange={(e) => updateStaticRoute(idx, 'subnetMask', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="255.255.255.0" />
                </div>
                <div className="md:col-span-1">
                   <label className="block text-xs font-medium text-slate-700 mb-1">Next Hop</label>
                   <input type="text" value={r.nextHop || ''} onChange={(e) => updateStaticRoute(idx, 'nextHop', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">VRF</label>
                  <select value={r.vrf || ''} onChange={(e) => updateStaticRoute(idx, 'vrf', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                     <option value="">Global</option>
                     {vrfOptions.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="flex items-end justify-end">
                  <button type="button" onClick={() => removeStaticRoute(idx)} className="text-red-600 text-sm py-2">Remove</button>
                </div>
              </div>
            </div>
          ))}
          {(routingConfig.staticRoutes || []).length === 0 && <p className="text-sm text-slate-500">No static routes configured.</p>}
        </div>
      </div>

      {/* --- OSPF --- */}
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
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Process ID</label>
                <input type="number" value={routingConfig.ospf.processId} onChange={(e) => updateConfig({ ospf: { ...routingConfig.ospf!, processId: Number(e.target.value) } })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Router ID</label>
                <input type="text" value={routingConfig.ospf.routerId || ''} onChange={(e) => updateConfig({ ospf: { ...routingConfig.ospf!, routerId: e.target.value } })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">VRF Instance</label>
                 <select value={routingConfig.ospf.vrf || ''} onChange={(e) => updateConfig({ ospf: { ...routingConfig.ospf!, vrf: e.target.value } })} className="w-full px-3 py-2 border rounded-lg text-sm">
                     <option value="">Global</option>
                     {vrfOptions.map(v => <option key={v} value={v}>{v}</option>)}
                 </select>
              </div>
            </div>

            {/* OSPF Networks */}
            <div className="border-t pt-4">
               <div className="flex justify-between items-center mb-2">
                 <h4 className="text-sm font-semibold">Networks</h4>
                 <button type="button" onClick={addOspfNetwork} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Add Network</button>
               </div>
               {routingConfig.ospf.networks.map((n, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-2 mb-2">
                     <input type="text" placeholder="Network" value={n.network} onChange={(e) => updateOspfNetwork(idx, 'network', e.target.value)} className="border rounded px-2 py-1 text-sm" />
                     <input type="text" placeholder="Wildcard" value={n.wildcard} onChange={(e) => updateOspfNetwork(idx, 'wildcard', e.target.value)} className="border rounded px-2 py-1 text-sm" />
                     <div className="flex gap-2">
                        <input type="number" placeholder="Area" value={n.area} onChange={(e) => updateOspfNetwork(idx, 'area', Number(e.target.value))} className="border rounded px-2 py-1 text-sm w-20" />
                        <button type="button" onClick={() => removeOspfNetwork(idx)} className="text-red-500 text-xs">x</button>
                     </div>
                  </div>
               ))}
            </div>
          </div>
        )}
      </div>

      {/* --- EIGRP --- */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">EIGRP</h3>
            <p className="text-sm text-slate-600">Configure Enhanced Interior Gateway Routing Protocol.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!routingConfig.eigrp?.enabled} onChange={(e) => toggleEigrp(e.target.checked)} />
            Enable
          </label>
        </div>

        {routingConfig.eigrp?.enabled && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">AS Number</label>
                <input type="number" value={routingConfig.eigrp.asn} onChange={(e) => updateConfig({ eigrp: { ...routingConfig.eigrp!, asn: Number(e.target.value) } })} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Router ID</label>
                <input type="text" value={routingConfig.eigrp.routerId || ''} onChange={(e) => updateConfig({ eigrp: { ...routingConfig.eigrp!, routerId: e.target.value } })} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Optional" />
              </div>
              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={routingConfig.eigrp.noAutoSummary} onChange={(e) => updateConfig({ eigrp: { ...routingConfig.eigrp!, noAutoSummary: e.target.checked } })} />
                  No Auto-Summary
                </label>
              </div>
            </div>

            {/* EIGRP Networks */}
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-semibold">Networks</h4>
                <button type="button" onClick={addEigrpNetwork} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Add Network</button>
              </div>
              {routingConfig.eigrp.networks.map((n, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-2 mb-2">
                  <input type="text" placeholder="Network" value={n.network} onChange={(e) => updateEigrpNetwork(idx, 'network', e.target.value)} className="border rounded px-2 py-1 text-sm" />
                  <input type="text" placeholder="Wildcard (optional)" value={n.wildcard || ''} onChange={(e) => updateEigrpNetwork(idx, 'wildcard', e.target.value)} className="border rounded px-2 py-1 text-sm" />
                  <button type="button" onClick={() => removeEigrpNetwork(idx)} className="text-red-500 text-xs">Remove</button>
                </div>
              ))}
            </div>

            {/* EIGRP Passive Interfaces */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-2">Passive Interfaces</h4>
              <div className="flex flex-wrap gap-2">
                {interfaceOptions.map((ifName) => (
                  <label key={ifName} className="flex items-center gap-1 text-xs bg-slate-100 px-2 py-1 rounded">
                    <input
                      type="checkbox"
                      checked={(routingConfig.eigrp?.passiveInterfaces || []).includes(ifName)}
                      onChange={() => toggleEigrpPassive(ifName)}
                    />
                    {ifName}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* --- BGP --- */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">BGP</h3>
            <p className="text-sm text-slate-600">Configure Border Gateway Protocol.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!routingConfig.bgp} onChange={(e) => toggleBgp(e.target.checked)} />
            Enable
          </label>
        </div>

        {routingConfig.bgp && (
            <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Local ASN</label>
                        <input type="number" value={routingConfig.bgp.asn} onChange={(e) => updateConfig({ bgp: { ...routingConfig.bgp!, asn: Number(e.target.value) } })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Router ID</label>
                        <input type="text" value={routingConfig.bgp.routerId || ''} onChange={(e) => updateConfig({ bgp: { ...routingConfig.bgp!, routerId: e.target.value } })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                </div>

                {/* Neighbors */}
                <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-semibold">Neighbors</h4>
                        <button type="button" onClick={addBgpNeighbor} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Add Neighbor</button>
                    </div>
                    {routingConfig.bgp.neighbors.map((n, idx) => (
                        <div key={idx} className="border rounded p-3 mb-2 bg-slate-50">
                            <div className="grid grid-cols-2 gap-3 mb-2">
                                <div>
                                    <label className="block text-xs text-slate-500">Neighbor IP</label>
                                    <input type="text" value={n.ip} onChange={(e) => updateBgpNeighbor(idx, 'ip', e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500">Remote AS</label>
                                    <input type="number" value={n.remoteAs} onChange={(e) => updateBgpNeighbor(idx, 'remoteAs', Number(e.target.value))} className="w-full border rounded px-2 py-1 text-sm" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mb-2">
                                <div>
                                    <label className="block text-xs text-slate-500">Update Source</label>
                                    <input type="text" value={n.updateSource || ''} onChange={(e) => updateBgpNeighbor(idx, 'updateSource', e.target.value)} className="w-full border rounded px-2 py-1 text-sm" placeholder="e.g. Loopback0" />
                                </div>
                                <div className="flex flex-col justify-end gap-1">
                                    <label className="flex items-center gap-2 text-xs">
                                        <input type="checkbox" checked={n.nextHopSelf} onChange={(e) => updateBgpNeighbor(idx, 'nextHopSelf', e.target.checked)} />
                                        Next Hop Self
                                    </label>
                                    <label className="flex items-center gap-2 text-xs">
                                        <input type="checkbox" checked={n.activateVpnv4} onChange={(e) => updateBgpNeighbor(idx, 'activateVpnv4', e.target.checked)} />
                                        Activate VPNv4
                                    </label>
                                </div>
                            </div>
                            <button type="button" onClick={() => removeBgpNeighbor(idx)} className="text-red-500 text-xs hover:underline">Remove Neighbor</button>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      {/* --- GRE Tunnels --- */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">VPN (GRE Tunnels)</h3>
            <p className="text-sm text-slate-600">Configure GRE tunnels with optional IPsec protection.</p>
          </div>
          <button type="button" onClick={addGreTunnel} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            Add Tunnel
          </button>
        </div>

        <div className="space-y-4">
          {(routingConfig.greTunnels || []).map((t, idx) => (
            <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <div className="grid md:grid-cols-3 gap-4 mb-3">
                 <div>
                    <label className="block text-xs font-medium text-slate-700">Tunnel #</label>
                    <input type="number" value={t.tunnelNumber} onChange={(e) => updateGreTunnel(idx, 'tunnelNumber', Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                 </div>
                 <div>
                    <label className="block text-xs font-medium text-slate-700">Source Int</label>
                    <select value={t.sourceInterface} onChange={(e) => updateGreTunnel(idx, 'sourceInterface', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                       <option value="">Select...</option>
                       {optionsWithCurrent(t.sourceInterface).map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-medium text-slate-700">Dest IP</label>
                    <input type="text" value={t.destinationIp} onChange={(e) => updateGreTunnel(idx, 'destinationIp', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                 </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Tunnel IP</label>
                    <input type="text" value={t.tunnelIp} onChange={(e) => updateGreTunnel(idx, 'tunnelIp', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="172.16.1.1" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Tunnel Mask</label>
                    <input type="text" value={t.tunnelMask} onChange={(e) => updateGreTunnel(idx, 'tunnelMask', e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
              </div>

              {/* IPsec Selection */}
              <div className="mb-3">
                  <label className="block text-xs font-medium text-slate-700 mb-1">IPsec Profile (Optional)</label>
                  <input 
                    type="text" 
                    value={t.ipsecProfile || ''} 
                    onChange={(e) => updateGreTunnel(idx, 'ipsecProfile', e.target.value)} 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Enter crypto profile name (e.g. PROTECT_GRE)"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Links to a crypto profile defined in the Security tab.</p>
              </div>

              <div className="flex justify-end">
                <button type="button" onClick={() => removeGreTunnel(idx)} className="text-red-600 text-sm hover:underline">Remove Tunnel</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Route Redistribution */}
      {routingConfig.ospf && routingConfig.eigrp?.enabled && (
        <div className="bg-white border border-yellow-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Route Redistribution</h3>
              <p className="text-sm text-slate-600">Redistribute routes between OSPF and EIGRP</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={routingConfig.redistributeEnabled || false}
                onChange={(e) => updateConfig({ redistributeEnabled: e.target.checked })}
              />
              Enable Redistribution
            </label>
          </div>

          {routingConfig.redistributeEnabled && (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                <p className="font-semibold mb-2">⚠️ Redistribution Configuration:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>OSPF will redistribute EIGRP {routingConfig.eigrp.asn} routes with subnets</li>
                  <li>EIGRP will redistribute OSPF {routingConfig.ospf.processId} routes with metrics</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  EIGRP Metric (Optional - default: 10000 100 255 1 1500)
                </label>
                <input
                  type="text"
                  value={routingConfig.redistributeMetric || ''}
                  onChange={(e) => updateConfig({ redistributeMetric: e.target.value })}
                  placeholder="bandwidth delay reliability load mtu"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Format: bandwidth delay reliability load mtu (e.g., "10000 100 255 1 1500")
                </p>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}