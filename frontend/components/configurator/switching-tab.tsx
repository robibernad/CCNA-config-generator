'use client'

import { useState, useEffect, useMemo } from 'react'

type SwitchType = 'l2' | 'msw'

interface Iface {
  name: string
  connected: boolean
}

type StpMode = 'pvst' | 'rapid-pvst'
type StpRootMode = 'primarySecondary' | 'manualPriority'
type StpRootRole = 'primary' | 'secondary'

type EtherProtocol = 'lacp' | 'pagp' | 'on'
type EtherChannelType = 'access' | 'trunk' | 'routed'
type LacpMode = 'active' | 'passive'
type PagpMode = 'desirable' | 'auto'

interface SwitchingConfig {
  vlans: Array<{ vlanId: number; name: string }>

  accessPorts: Array<{
    interface: string
    vlanId: number
    portfast?: boolean
    bpduGuard?: boolean
    description?: string
  }>

  trunkPorts: Array<{
    interface: string
    allowedVlans: string
    nativeVlan?: number
    rootGuard?: boolean
    description?: string
  }>

  stp?: {
    mode: StpMode
    vlanScope: 'all' | 'custom'
    vlans?: string
    rootMode: StpRootMode
    rootRole?: StpRootRole
    priority?: number
  }

  etherChannels: Array<{
    id: number
    protocol: EtherProtocol
    lacpMode?: LacpMode
    pagpMode?: PagpMode
    members: string[]
    channelType: EtherChannelType
    accessVlanId?: number
    allowedVlans?: string
    nativeVlan?: number
    ipAddress?: string
    subnetMask?: string
    description?: string
  }>
}

interface Props {
  interfaces: Iface[]
  deviceType: string
  switchType?: SwitchType
  config?: any
  onUpdate: (config: any) => void
}

const PRIORITY_VALUES = Array.from({ length: 16 }, (_, i) => i * 4096) // 0..61440

function ensureVlan99(vlans: Array<{ vlanId: number; name: string }>) {
  return vlans.some((v) => v.vlanId === 99) ? vlans : [...vlans, { vlanId: 99, name: 'MGMT' }]
}

function normalizeConfig(input: any): SwitchingConfig {
  const base: SwitchingConfig = {
    vlans: [],
    accessPorts: [],
    trunkPorts: [],
    // IMPORTANT: don’t force “root primary for all VLANs” by default
    stp: {
      mode: 'rapid-pvst',
      vlanScope: 'all',
      rootMode: 'primarySecondary',
      rootRole: undefined, // <- only emit if user explicitly picks
      priority: undefined,
      vlans: undefined,
    },
    etherChannels: [],
  }

  if (!input) {
    base.vlans = ensureVlan99(base.vlans)
    return base
  }

  const ether = input.etherChannels ?? input.etherchannels ?? input.ether_channels ?? []

  const merged: SwitchingConfig = {
    ...base,
    ...input,
    etherChannels: ether,
    stp: {
      ...base.stp!,
      ...(input.stp || {}),
    },
  }

  merged.vlans = merged.vlans || []
  merged.accessPorts = merged.accessPorts || []
  merged.trunkPorts = merged.trunkPorts || []
  merged.etherChannels = merged.etherChannels || []

  if (merged.vlans.length === 0) merged.vlans = ensureVlan99(merged.vlans)

  return merged
}

export function SwitchingTab({ interfaces, deviceType, switchType, config, onUpdate }: Props) {
  const isSwitch = deviceType === 'switch'
  const isMsw = isSwitch && switchType === 'msw'

  const initial = useMemo(() => normalizeConfig(config), [config])
  const [localConfig, setLocalConfig] = useState<SwitchingConfig>(initial)

  useEffect(() => setLocalConfig(initial), [initial])

  const push = (next: SwitchingConfig) => {
    setLocalConfig(next)
    onUpdate(next)
  }

  // ---------- connected-only filtering helpers ----------
  const connectedIfaces = useMemo(() => interfaces.filter((i) => i.connected), [interfaces])

  const visibleForSelect = (currentSelected?: string) => {
    // show only connected + keep the currently-selected (even if not connected)
    const set = new Set<string>(connectedIfaces.map((i) => i.name))
    if (currentSelected) set.add(currentSelected)

    return interfaces.filter((i) => set.has(i.name))
  }

  const firstConnectedOrAny = () => connectedIfaces[0]?.name || interfaces[0]?.name || 'GigabitEthernet0/1'

  // ---------------- VLANs ----------------
  const addVlan = () => push({ ...localConfig, vlans: [...localConfig.vlans, { vlanId: 10, name: 'VLAN10' }] })
  const addVlan99 = () => push({ ...localConfig, vlans: ensureVlan99(localConfig.vlans) })

  const updateVlan = (index: number, field: string, value: any) => {
    const updated = [...localConfig.vlans]
    updated[index] = { ...updated[index], [field]: value }
    push({ ...localConfig, vlans: updated })
  }

  const removeVlan = (index: number) => push({ ...localConfig, vlans: localConfig.vlans.filter((_, i) => i !== index) })

  // ---------------- Access ports ----------------
  const addAccessPort = () => {
    push({
      ...localConfig,
      accessPorts: [
        ...localConfig.accessPorts,
        {
          interface: firstConnectedOrAny(),
          vlanId: 10,
          portfast: true,
          bpduGuard: true,
        },
      ],
    })
  }

  const updateAccessPort = (index: number, patch: any) => {
    const updated = [...localConfig.accessPorts]
    updated[index] = { ...updated[index], ...patch }
    push({ ...localConfig, accessPorts: updated })
  }

  const removeAccessPort = (index: number) => push({ ...localConfig, accessPorts: localConfig.accessPorts.filter((_, i) => i !== index) })

  // ---------------- Trunk ports ----------------
  const addTrunkPort = () => {
    push({
      ...localConfig,
      trunkPorts: [
        ...localConfig.trunkPorts,
        {
          interface: firstConnectedOrAny(),
          allowedVlans: 'all',
          nativeVlan: 99,
          rootGuard: false,
        },
      ],
    })
  }

  const updateTrunkPort = (index: number, patch: any) => {
    const updated = [...localConfig.trunkPorts]
    updated[index] = { ...updated[index], ...patch }
    push({ ...localConfig, trunkPorts: updated })
  }

  const removeTrunkPort = (index: number) => push({ ...localConfig, trunkPorts: localConfig.trunkPorts.filter((_, i) => i !== index) })

  // ---------------- STP ----------------
  const updateStp = (patch: any) => {
    const stp = localConfig.stp || {
      mode: 'rapid-pvst',
      vlanScope: 'all',
      rootMode: 'primarySecondary',
      rootRole: undefined,
      priority: undefined,
      vlans: undefined,
    }

    const nextStp: any = { ...stp, ...patch }

    // normalize root config
    if (nextStp.rootMode === 'primarySecondary') {
      delete nextStp.priority
      // don’t force default rootRole; user must choose (else we’d generate “root primary all vlans”)
      if (patch.rootMode && !patch.rootRole) nextStp.rootRole = undefined
    } else {
      delete nextStp.rootRole
      if (typeof nextStp.priority !== 'number') nextStp.priority = 32768
    }

    // normalize vlan scope
    if (nextStp.vlanScope === 'all') {
      delete nextStp.vlans
    } else {
      if (typeof nextStp.vlans !== 'string') nextStp.vlans = ''
    }

    push({ ...localConfig, stp: nextStp })
  }

  // ---------------- EtherChannel ----------------
  const addEtherChannel = () => {
    const usedIds = new Set(localConfig.etherChannels.map((e) => e.id))
    let id = 1
    while (usedIds.has(id) && id < 128) id++

    push({
      ...localConfig,
      etherChannels: [
        ...localConfig.etherChannels,
        {
          id,
          protocol: 'lacp',
          lacpMode: 'active',
          members: [],
          channelType: 'trunk',
          allowedVlans: 'all',
          nativeVlan: 99,
        },
      ],
    })
  }

  const updateEtherChannel = (index: number, patch: any) => {
    const updated = [...localConfig.etherChannels]
    const cur = updated[index]
    let next: any = { ...cur, ...patch }

    // per-protocol normalization
    if (next.protocol === 'lacp') {
      next.lacpMode = next.lacpMode || 'active'
      delete next.pagpMode
    } else if (next.protocol === 'pagp') {
      next.pagpMode = next.pagpMode || 'desirable'
      delete next.lacpMode
    } else {
      delete next.lacpMode
      delete next.pagpMode
    }

    // per-channel-type normalization
    if (next.channelType === 'access') {
      next.accessVlanId = next.accessVlanId ?? 10
      delete next.allowedVlans
      delete next.nativeVlan
      delete next.ipAddress
      delete next.subnetMask
    } else if (next.channelType === 'trunk') {
      next.allowedVlans = next.allowedVlans ?? 'all'
      next.nativeVlan = next.nativeVlan ?? 99
      delete next.accessVlanId
      delete next.ipAddress
      delete next.subnetMask
    } else {
      delete next.accessVlanId
      delete next.allowedVlans
      delete next.nativeVlan
      next.ipAddress = typeof next.ipAddress === 'string' ? next.ipAddress : ''
      next.subnetMask = typeof next.subnetMask === 'string' ? next.subnetMask : '255.255.255.0'
    }

    next.members = Array.isArray(next.members) ? next.members : []
    updated[index] = next
    push({ ...localConfig, etherChannels: updated })
  }

  const removeEtherChannel = (index: number) => push({ ...localConfig, etherChannels: localConfig.etherChannels.filter((_, i) => i !== index) })

  const toggleEtherMember = (ecIndex: number, ifName: string) => {
    const ec = localConfig.etherChannels[ecIndex]
    const has = ec.members.includes(ifName)
    const members = has ? ec.members.filter((m) => m !== ifName) : [...ec.members, ifName]
    updateEtherChannel(ecIndex, { members })
  }

  const hasVlan99 = localConfig.vlans.some((v) => v.vlanId === 99)

  return (
    <div className="space-y-10">
      {/* VLANs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-800">VLANs</h3>
            {!hasVlan99 && (
              <button
                onClick={addVlan99}
                className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs hover:bg-slate-900"
                title="Adds VLAN 99 named MGMT"
              >
                + Add VLAN 99 (MGMT)
              </button>
            )}
          </div>
          <button onClick={addVlan} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            + Add VLAN
          </button>
        </div>

        {localConfig.vlans.length === 0 ? (
          <div className="text-center py-6 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
            No VLANs configured
          </div>
        ) : (
          <div className="space-y-2">
            {localConfig.vlans.map((vlan, index) => (
              <div key={index} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">VLAN ID</label>
                    <input
                      type="number"
                      min={1}
                      max={4094}
                      value={vlan.vlanId}
                      onChange={(e) => updateVlan(index, 'vlanId', parseInt(e.target.value || '1', 10))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Name</label>
                    <input
                      type="text"
                      value={vlan.name}
                      onChange={(e) => updateVlan(index, 'name', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
                <button onClick={() => removeVlan(index)} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* STP */}
      <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">Spanning Tree (STP)</h3>
          <span className="text-xs text-slate-500">Root config is optional</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Mode</label>
            <select
              value={localConfig.stp?.mode || 'rapid-pvst'}
              onChange={(e) => updateStp({ mode: e.target.value as StpMode })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="rapid-pvst">rapid-pvst</option>
              <option value="pvst">pvst</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">VLAN Scope</label>
            <select
              value={localConfig.stp?.vlanScope || 'all'}
              onChange={(e) => updateStp({ vlanScope: e.target.value as 'all' | 'custom' })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="all">All VLANs</option>
              <option value="custom">Custom list</option>
            </select>
            {localConfig.stp?.vlanScope === 'custom' && (
              <input
                type="text"
                value={localConfig.stp?.vlans || ''}
                onChange={(e) => updateStp({ vlans: e.target.value })}
                placeholder="10,20,99"
                className="w-full mt-2 px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Root Setting</label>
            <select
              value={localConfig.stp?.rootMode || 'primarySecondary'}
              onChange={(e) => updateStp({ rootMode: e.target.value as StpRootMode })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="primarySecondary">Root primary/secondary</option>
              <option value="manualPriority">Manual priority</option>
            </select>
          </div>

          <div>
            {localConfig.stp?.rootMode === 'primarySecondary' ? (
              <>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Role <span className="text-slate-400">(optional)</span>
                </label>
                <select
                  value={localConfig.stp?.rootRole || ''}
                  onChange={(e) => updateStp({ rootRole: (e.target.value || undefined) as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="">(do not set root)</option>
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                </select>
              </>
            ) : (
              <>
                <label className="block text-sm font-medium text-slate-600 mb-1">Priority</label>
                <select
                  value={localConfig.stp?.priority ?? 32768}
                  onChange={(e) => updateStp({ priority: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  {PRIORITY_VALUES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-500">
          Root commands are generated only if you choose a Role (or Manual Priority).
        </div>
      </div>

      {/* Access Ports */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Access Ports</h3>
          <button onClick={addAccessPort} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
            + Add Access Port
          </button>
        </div>

        {localConfig.accessPorts.length === 0 ? (
          <div className="text-center py-6 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
            No access ports configured
          </div>
        ) : (
          <div className="space-y-2">
            {localConfig.accessPorts.map((port, index) => (
              <div key={index} className="p-3 bg-green-50 rounded-lg space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={port.interface}
                    onChange={(e) => updateAccessPort(index, { interface: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    {visibleForSelect(port.interface).map((i) => (
                      <option key={i.name} value={i.name}>
                        {i.name} {i.connected ? '(connected)' : '(not connected)'}
                      </option>
                    ))}
                  </select>

                  <span className="text-slate-500">→ VLAN</span>

                  <input
                    type="number"
                    min={1}
                    max={4094}
                    value={port.vlanId}
                    onChange={(e) => updateAccessPort(index, { vlanId: parseInt(e.target.value || '1', 10) })}
                    className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />

                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={port.portfast ?? true} onChange={(e) => updateAccessPort(index, { portfast: e.target.checked })} />
                    PortFast
                  </label>

                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={port.bpduGuard ?? true} onChange={(e) => updateAccessPort(index, { bpduGuard: e.target.checked })} />
                    BPDU Guard
                  </label>

                  <button onClick={() => removeAccessPort(index)} className="ml-auto px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg">
                    Remove
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={port.description || ''}
                    onChange={(e) => updateAccessPort(index, { description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="PC / Printer / AP"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trunk Ports */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Trunk Ports</h3>
          <button onClick={addTrunkPort} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
            + Add Trunk Port
          </button>
        </div>

        {localConfig.trunkPorts.length === 0 ? (
          <div className="text-center py-6 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
            No trunk ports configured
          </div>
        ) : (
          <div className="space-y-2">
            {localConfig.trunkPorts.map((port, index) => (
              <div key={index} className="p-3 bg-purple-50 rounded-lg space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={port.interface}
                    onChange={(e) => updateTrunkPort(index, { interface: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    {visibleForSelect(port.interface).map((i) => (
                      <option key={i.name} value={i.name}>
                        {i.name} {i.connected ? '(connected)' : '(not connected)'}
                      </option>
                    ))}
                  </select>

                  <span className="text-slate-500">Allowed VLANs</span>

                  <input
                    type="text"
                    value={port.allowedVlans || 'all'}
                    onChange={(e) => updateTrunkPort(index, { allowedVlans: e.target.value })}
                    placeholder="all or 10,20,99"
                    className="min-w-[220px] flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />

                  <span className="text-slate-500">Native</span>
                  <input
                    type="number"
                    min={1}
                    max={4094}
                    value={port.nativeVlan ?? 99}
                    onChange={(e) => updateTrunkPort(index, { nativeVlan: parseInt(e.target.value || '99', 10) })}
                    className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />

                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={port.rootGuard ?? false} onChange={(e) => updateTrunkPort(index, { rootGuard: e.target.checked })} />
                    Root Guard (optional)
                  </label>

                  <button onClick={() => removeTrunkPort(index)} className="ml-auto px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg">
                    Remove
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={port.description || ''}
                    onChange={(e) => updateTrunkPort(index, { description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    placeholder="Uplink / Peer link"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EtherChannel */}
      <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">EtherChannel</h3>
          <button onClick={addEtherChannel} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-900">
            + Add EtherChannel
          </button>
        </div>

        {localConfig.etherChannels.length === 0 ? (
          <div className="text-center py-6 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
            No EtherChannels configured
          </div>
        ) : (
          <div className="space-y-4">
            {localConfig.etherChannels.map((ec, idx) => {
              // show only connected members by default; keep checked visible
              const visibleMembers = interfaces.filter((i) => i.connected || ec.members.includes(i.name))

              return (
                <div key={idx} className="border border-slate-200 rounded-lg p-4 bg-white space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Port-channel ID</label>
                      <input
                        type="number"
                        min={1}
                        max={128}
                        value={ec.id}
                        onChange={(e) => updateEtherChannel(idx, { id: parseInt(e.target.value || '1', 10) })}
                        className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Protocol</label>
                      <select
                        value={ec.protocol}
                        onChange={(e) => updateEtherChannel(idx, { protocol: e.target.value as EtherProtocol })}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      >
                        <option value="lacp">LACP</option>
                        <option value="pagp">PAgP</option>
                        <option value="on">On</option>
                      </select>
                    </div>

                    {ec.protocol === 'lacp' && (
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">LACP Mode</label>
                        <select
                          value={ec.lacpMode || 'active'}
                          onChange={(e) => updateEtherChannel(idx, { lacpMode: e.target.value as LacpMode })}
                          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        >
                          <option value="active">active</option>
                          <option value="passive">passive</option>
                        </select>
                      </div>
                    )}

                    {ec.protocol === 'pagp' && (
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">PAgP Mode</label>
                        <select
                          value={ec.pagpMode || 'desirable'}
                          onChange={(e) => updateEtherChannel(idx, { pagpMode: e.target.value as PagpMode })}
                          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        >
                          <option value="desirable">desirable</option>
                          <option value="auto">auto</option>
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Channel Type</label>
                      <select
                        value={ec.channelType}
                        onChange={(e) => updateEtherChannel(idx, { channelType: e.target.value as EtherChannelType })}
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      >
                        <option value="trunk">Trunk</option>
                        <option value="access">Access</option>
                        <option value="routed" disabled={!isMsw}>
                          Routed (MSW)
                        </option>
                      </select>
                    </div>

                    <button onClick={() => removeEtherChannel(idx)} className="ml-auto px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg">
                      Remove
                    </button>
                  </div>

                  {/* Members */}
                  <div>
                    <div className="text-sm font-medium text-slate-700 mb-2">Member interfaces</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {visibleMembers.map((i) => {
                        const checked = ec.members.includes(i.name)
                        return (
                          <label
                            key={i.name}
                            className={`flex items-center gap-2 p-2 rounded border text-sm cursor-pointer ${
                              checked ? 'border-blue-400 bg-blue-50' : 'border-slate-200'
                            }`}
                          >
                            <input type="checkbox" checked={checked} onChange={() => toggleEtherMember(idx, i.name)} />
                            {i.name} {i.connected ? '' : '(not connected)'}
                          </label>
                        )
                      })}
                    </div>
                    <div className="text-xs text-slate-500 mt-2">
                      Only connected ports are shown by default. Selected-but-not-connected ports remain visible so you can unselect them.
                    </div>
                  </div>

                  {/* Channel settings */}
                  {ec.channelType === 'access' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Access VLAN</label>
                        <input
                          type="number"
                          min={1}
                          max={4094}
                          value={ec.accessVlanId ?? 10}
                          onChange={(e) => updateEtherChannel(idx, { accessVlanId: parseInt(e.target.value || '10', 10) })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs text-slate-500 mb-1">Description (optional)</label>
                        <input
                          type="text"
                          value={ec.description || ''}
                          onChange={(e) => updateEtherChannel(idx, { description: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          placeholder="Access bundle"
                        />
                      </div>
                    </div>
                  )}

                  {ec.channelType === 'trunk' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-xs text-slate-500 mb-1">Allowed VLANs</label>
                        <input
                          type="text"
                          value={ec.allowedVlans || 'all'}
                          onChange={(e) => updateEtherChannel(idx, { allowedVlans: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          placeholder="all or 10,20,99"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Native VLAN</label>
                        <input
                          type="number"
                          min={1}
                          max={4094}
                          value={ec.nativeVlan ?? 99}
                          onChange={(e) => updateEtherChannel(idx, { nativeVlan: parseInt(e.target.value || '99', 10) })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-xs text-slate-500 mb-1">Description (optional)</label>
                        <input
                          type="text"
                          value={ec.description || ''}
                          onChange={(e) => updateEtherChannel(idx, { description: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          placeholder="Uplink bundle"
                        />
                      </div>
                    </div>
                  )}

                  {ec.channelType === 'routed' && isMsw && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">IP Address</label>
                        <input
                          type="text"
                          value={ec.ipAddress || ''}
                          onChange={(e) => updateEtherChannel(idx, { ipAddress: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          placeholder="10.0.0.2"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Subnet Mask</label>
                        <select
                          value={ec.subnetMask || '255.255.255.0'}
                          onChange={(e) => updateEtherChannel(idx, { subnetMask: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        >
                          <option value="255.255.255.0">/24 - 255.255.255.0</option>
                          <option value="255.255.255.252">/30 - 255.255.255.252</option>
                          <option value="255.255.255.248">/29 - 255.255.255.248</option>
                          <option value="255.255.255.240">/28 - 255.255.255.240</option>
                          <option value="255.255.255.128">/25 - 255.255.255.128</option>
                        </select>
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-xs text-slate-500 mb-1">Description (optional)</label>
                        <input
                          type="text"
                          value={ec.description || ''}
                          onChange={(e) => updateEtherChannel(idx, { description: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                          placeholder="L3 bundle"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
