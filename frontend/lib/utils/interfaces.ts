export type DeviceInterface = {
  name: string
  connected?: boolean
}

/**
 * Extract physical switch ports already consumed by switching config.
 * This helps prevent selecting the same physical port as both L2 (access/trunk/EtherChannel)
 * and L3 (routed interface, OSPF interface binding, NAT inside/outside, etc.).
 */
export function getUsedSwitchPorts(switching: any): Set<string> {
  const used = new Set<string>()
  if (!switching || typeof switching !== "object") return used

  const accessPorts = switching.accessPorts ?? switching.access_ports ?? []
  const trunkPorts = switching.trunkPorts ?? switching.trunk_ports ?? []
  const etherchannels = switching.etherchannels ?? switching.etherChannels ?? switching.ether_channels ?? []

  const addIface = (v: any) => {
    if (typeof v === "string" && v.trim()) used.add(v.trim())
  }

  for (const p of accessPorts) addIface(p?.interface)
  for (const p of trunkPorts) addIface(p?.interface)

  for (const ec of etherchannels) {
    const members = ec?.members ?? []
    if (Array.isArray(members)) {
      for (const m of members) {
        if (typeof m === "string") addIface(m)
        else addIface(m?.interface)
      }
    }
  }

  return used
}

/**
 * Filter a device interface list down to interfaces that are (a) connected and (b) not already used
 * by switching config, while always keeping anything currently selected.
 */
export function getSelectableInterfaces(
  interfaces: DeviceInterface[] = [],
  used: Set<string> = new Set(),
  selected: string[] = [],
): DeviceInterface[] {
  const selectedSet = new Set(selected.filter(Boolean))

  return interfaces
    .filter((i) => {
      const name = i?.name
      if (!name) return false
      if (selectedSet.has(name)) return true
      if (i.connected === false) return false
      return !used.has(name)
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}
