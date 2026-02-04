import { useState } from 'react'

interface LocalUser {
  username: string
  privilege?: number
  secret?: string
  password?: string
}

interface SshAccess {
  enabled: boolean
  domainName?: string
  rsaModulus?: number
  version?: number
  vtyStart?: number
  vtyEnd?: number
  allowTelnet?: boolean
  execTimeoutMin?: number
  execTimeoutSec?: number
}

interface DeviceAccess {
  enableSecret?: string
  servicePasswordEncryption?: boolean
  bannerMotd?: string
  users: LocalUser[]
  ssh: SshAccess
}

// --- ACL Models ---
interface StandardAclEntry {
    action: string
    source: string
    wildcard?: string
}

interface ExtendedAclEntry {
    action: string
    protocol: string
    source: string
    sourceWildcard?: string
    destination: string
    destinationWildcard?: string
    port?: string
}

interface StandardAcl {
    number: number
    entries: StandardAclEntry[]
}

interface ExtendedAcl {
    numberOrName: string
    entries: ExtendedAclEntry[]
}

// --- VPN Interfaces ---

interface IPsecPhase1 {
  policyId: number
  encryption: 'aes' | '3des' | 'des'
  hash: 'sha' | 'md5' | 'sha256'
  authentication: 'pre-share' | 'rsa-encr'
  group: number
  lifetime: number
  key: string
}

interface IPsecPhase2 {
  name: string
  protocol: string
  mode: 'tunnel' | 'transport'
}

interface IPsecMap {
  name: string
  priority: number
  peerIp: string
  transformSet: string
  matchAcl: string
}

interface SecurityConfig {
  deviceAccess: DeviceAccess
  standardAcls: StandardAcl[]
  extendedAcls: ExtendedAcl[]
  aclApplications: any[]
  // New VPN Fields
  ipsecPhase1: IPsecPhase1[]
  ipsecPhase2: IPsecPhase2[]
  ipsecMaps: IPsecMap[]
}

interface Props {
  config?: any
  onUpdate: (config: any) => void
  deviceType?: string // New Prop
}

export function SecurityTab({ config, onUpdate, deviceType }: Props) {
  const isRouter = deviceType === 'router' // Only show VPN for Routers

  const initialConfig: SecurityConfig = {
    deviceAccess: {
      enableSecret: '',
      servicePasswordEncryption: false,
      bannerMotd: '',
      users: [],
      ssh: {
        enabled: false,
        domainName: '',
        rsaModulus: 2048,
        version: 2,
        vtyStart: 0,
        vtyEnd: 4,
        allowTelnet: false,
        execTimeoutMin: 10,
        execTimeoutSec: 0,
      },
    },
    standardAcls: [],
    extendedAcls: [],
    aclApplications: [],
    ipsecPhase1: [],
    ipsecPhase2: [],
    ipsecMaps: [],
  }

  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>(() => {
    if (!config) return initialConfig

    const incoming = config as any
    const da = (incoming.deviceAccess || incoming.device_access || {}) as any
    const ssh = (da.ssh || {}) as any

    return {
      deviceAccess: {
        enableSecret: da.enableSecret ?? da.enable_secret ?? '',
        servicePasswordEncryption: !!(da.servicePasswordEncryption ?? da.service_password_encryption ?? false),
        bannerMotd: da.bannerMotd ?? da.banner_motd ?? '',
        users: da.users || [],
        ssh: {
          enabled: !!(ssh.enabled ?? false),
          domainName: ssh.domainName ?? '',
          rsaModulus: ssh.rsaModulus ?? 2048,
          version: ssh.version ?? 2,
          vtyStart: ssh.vtyStart ?? 0,
          vtyEnd: ssh.vtyEnd ?? 4,
          allowTelnet: !!(ssh.allowTelnet ?? false),
          execTimeoutMin: ssh.execTimeoutMin ?? 10,
          execTimeoutSec: ssh.execTimeoutSec ?? 0,
        },
      },
      standardAcls: incoming.standardAcls || [],
      extendedAcls: incoming.extendedAcls || [],
      aclApplications: incoming.aclApplications || [],
      ipsecPhase1: incoming.ipsecPhase1 || [],
      ipsecPhase2: incoming.ipsecPhase2 || [],
      ipsecMaps: incoming.ipsecMaps || [],
    }
  })

  const push = (next: SecurityConfig) => {
    setSecurityConfig(next)
    onUpdate(next as any)
  }

  // ---------------- Device Access ----------------
  const updateDeviceAccess = (updates: Partial<DeviceAccess>) => {
    push({ ...securityConfig, deviceAccess: { ...securityConfig.deviceAccess, ...updates } })
  }

  const updateSsh = (updates: Partial<SshAccess>) => {
    const da = securityConfig.deviceAccess
    updateDeviceAccess({ ssh: { ...da.ssh, ...updates } })
  }

  const addUser = () => {
    const users = [...(securityConfig.deviceAccess.users || [])]
    users.push({ username: 'admin', privilege: 15, secret: '', password: '' })
    updateDeviceAccess({ users })
  }

  const updateUser = (idx: number, updates: Partial<LocalUser>) => {
    const users = [...(securityConfig.deviceAccess.users || [])]
    users[idx] = { ...users[idx], ...updates }
    updateDeviceAccess({ users })
  }

  const removeUser = (idx: number) => {
    const users = (securityConfig.deviceAccess.users || []).filter((_, i) => i !== idx)
    updateDeviceAccess({ users })
  }

  // ---------------- ACLs (existing) ----------------
  const addStandardAcl = () => {
    const updated = [...securityConfig.standardAcls, { number: 1, entries: [] }]
    push({ ...securityConfig, standardAcls: updated })
  }
  const addStandardEntry = (aclIdx: number) => {
      const updated = [...securityConfig.standardAcls];
      updated[aclIdx].entries.push({ action: 'permit', source: 'any' });
      push({ ...securityConfig, standardAcls: updated });
  }
  const updateStandardEntry = (aclIdx: number, entryIdx: number, patch: Partial<StandardAclEntry>) => {
      const updated = [...securityConfig.standardAcls];
      updated[aclIdx].entries[entryIdx] = { ...updated[aclIdx].entries[entryIdx], ...patch };
      push({ ...securityConfig, standardAcls: updated });
  }

  const removeStandardAcl = (index: number) => {
    const updated = securityConfig.standardAcls.filter((_, i) => i !== index)
    push({ ...securityConfig, standardAcls: updated })
  }

  const addExtendedAcl = () => {
    const updated = [...securityConfig.extendedAcls, { numberOrName: '100', entries: [] }]
    push({ ...securityConfig, extendedAcls: updated })
  }
  const addExtendedEntry = (aclIdx: number) => {
      const updated = [...securityConfig.extendedAcls];
      updated[aclIdx].entries.push({ action: 'permit', protocol: 'ip', source: 'any', destination: 'any' });
      push({ ...securityConfig, extendedAcls: updated });
  }
  const updateExtendedEntry = (aclIdx: number, entryIdx: number, patch: Partial<ExtendedAclEntry>) => {
      const updated = [...securityConfig.extendedAcls];
      updated[aclIdx].entries[entryIdx] = { ...updated[aclIdx].entries[entryIdx], ...patch };
      push({ ...securityConfig, extendedAcls: updated });
  }

  const removeExtendedAcl = (index: number) => {
    const updated = securityConfig.extendedAcls.filter((_, i) => i !== index)
    push({ ...securityConfig, extendedAcls: updated })
  }

  const addAclApplication = () => {
    const updated = [...securityConfig.aclApplications, { interface: '', acl: '', direction: 'in' }]
    push({ ...securityConfig, aclApplications: updated })
  }

  const removeAclApplication = (index: number) => {
    const updated = securityConfig.aclApplications.filter((_, i) => i !== index)
    push({ ...securityConfig, aclApplications: updated })
  }

  // ---------------- VPN: Phase 1 ----------------
  const addPhase1 = () => {
    const updated = [...securityConfig.ipsecPhase1, {
      policyId: 10, encryption: 'aes', hash: 'sha', authentication: 'pre-share',
      group: 2, lifetime: 86400, key: 'cisco123'
    } as IPsecPhase1]
    push({ ...securityConfig, ipsecPhase1: updated })
  }
  const updatePhase1 = (idx: number, updates: Partial<IPsecPhase1>) => {
    const updated = [...securityConfig.ipsecPhase1]
    updated[idx] = { ...updated[idx], ...updates }
    push({ ...securityConfig, ipsecPhase1: updated })
  }
  const removePhase1 = (idx: number) => {
    push({ ...securityConfig, ipsecPhase1: securityConfig.ipsecPhase1.filter((_, i) => i !== idx) })
  }

  // ---------------- VPN: Phase 2 ----------------
  const addPhase2 = () => {
    const updated = [...securityConfig.ipsecPhase2, {
      name: 'TRANSFORM_SET', protocol: 'esp-aes esp-sha-hmac', mode: 'tunnel'
    } as IPsecPhase2]
    push({ ...securityConfig, ipsecPhase2: updated })
  }
  const updatePhase2 = (idx: number, updates: Partial<IPsecPhase2>) => {
    const updated = [...securityConfig.ipsecPhase2]
    updated[idx] = { ...updated[idx], ...updates }
    push({ ...securityConfig, ipsecPhase2: updated })
  }
  const removePhase2 = (idx: number) => {
    push({ ...securityConfig, ipsecPhase2: securityConfig.ipsecPhase2.filter((_, i) => i !== idx) })
  }

  // ---------------- VPN: Crypto Maps ----------------
  const addMap = () => {
    const updated = [...securityConfig.ipsecMaps, {
      name: 'VPN_MAP', priority: 10, peerIp: '', transformSet: 'TRANSFORM_SET', matchAcl: ''
    } as IPsecMap]
    push({ ...securityConfig, ipsecMaps: updated })
  }
  const updateMap = (idx: number, updates: Partial<IPsecMap>) => {
    const updated = [...securityConfig.ipsecMaps]
    updated[idx] = { ...updated[idx], ...updates }
    push({ ...securityConfig, ipsecMaps: updated })
  }
  const removeMap = (idx: number) => {
    push({ ...securityConfig, ipsecMaps: securityConfig.ipsecMaps.filter((_, i) => i !== idx) })
  }

  return (
    <div className="space-y-6">
      {/* Device Access */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-slate-800">Device Access (SSH, Users)</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Enable Secret</label>
              <input
                type="text"
                value={securityConfig.deviceAccess.enableSecret || ''}
                onChange={(e) => updateDeviceAccess({ enableSecret: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                placeholder="e.g. class"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                checked={!!securityConfig.deviceAccess.servicePasswordEncryption}
                onChange={(e) => updateDeviceAccess({ servicePasswordEncryption: e.target.checked })}
              />
              <span className="text-sm text-slate-700">service password-encryption</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Banner MOTD (optional)</label>
            <textarea
              value={securityConfig.deviceAccess.bannerMotd || ''}
              onChange={(e) => updateDeviceAccess({ bannerMotd: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              rows={3}
              placeholder="Unauthorized access is prohibited..."
            />
          </div>

          <div className="border rounded-lg p-4 bg-white">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-slate-800">Local Users</h4>
              <button
                onClick={addUser}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Add User
              </button>
            </div>

            {(securityConfig.deviceAccess.users || []).length === 0 ? (
              <p className="text-sm text-slate-600">No users yet. SSH "login local" needs at least one user.</p>
            ) : (
              <div className="space-y-3">
                {securityConfig.deviceAccess.users.map((u, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end border-b pb-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
                      <input
                        type="text"
                        value={u.username}
                        onChange={(e) => updateUser(idx, { username: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Privilege</label>
                      <input
                        type="number"
                        min={1}
                        max={15}
                        value={u.privilege ?? 1}
                        onChange={(e) => updateUser(idx, { privilege: parseInt(e.target.value || '1', 10) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Secret</label>
                      <input
                        type="text"
                        value={u.secret || ''}
                        onChange={(e) => updateUser(idx, { secret: e.target.value, password: '' })}
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                        placeholder="preferred"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
                      <input
                        type="text"
                        value={u.password || ''}
                        onChange={(e) => updateUser(idx, { password: e.target.value, secret: '' })}
                        className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                        placeholder="(if not using secret)"
                      />
                    </div>
                    <button
                      onClick={() => removeUser(idx)}
                      className="px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border rounded-lg p-4 bg-white">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-slate-800">SSH</h4>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={securityConfig.deviceAccess.ssh.enabled}
                  onChange={(e) => updateSsh({ enabled: e.target.checked })}
                />
                Enabled
              </label>
            </div>

            {securityConfig.deviceAccess.ssh.enabled ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Domain Name</label>
                  <input
                    type="text"
                    value={securityConfig.deviceAccess.ssh.domainName || ''}
                    onChange={(e) => updateSsh({ domainName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                    placeholder="example.local"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">RSA Modulus</label>
                  <select
                    value={securityConfig.deviceAccess.ssh.rsaModulus || 2048}
                    onChange={(e) => updateSsh({ rsaModulus: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  >
                    <option value={1024}>1024</option>
                    <option value={2048}>2048</option>
                    <option value={4096}>4096</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">SSH Version</label>
                  <select
                    value={securityConfig.deviceAccess.ssh.version || 2}
                    onChange={(e) => updateSsh({ version: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  >
                    <option value={2}>2 (recommended)</option>
                    <option value={1}>1</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">VTY Start</label>
                  <input
                    type="number"
                    min={0}
                    max={15}
                    value={securityConfig.deviceAccess.ssh.vtyStart ?? 0}
                    onChange={(e) => updateSsh({ vtyStart: parseInt(e.target.value || '0', 10) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">VTY End</label>
                  <input
                    type="number"
                    min={0}
                    max={15}
                    value={securityConfig.deviceAccess.ssh.vtyEnd ?? 4}
                    onChange={(e) => updateSsh({ vtyEnd: parseInt(e.target.value || '4', 10) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    checked={!!securityConfig.deviceAccess.ssh.allowTelnet}
                    onChange={(e) => updateSsh({ allowTelnet: e.target.checked })}
                  />
                  <span className="text-sm text-slate-700">Allow Telnet (not recommended)</span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Exec Timeout (min)</label>
                  <input
                    type="number"
                    min={0}
                    value={securityConfig.deviceAccess.ssh.execTimeoutMin ?? 10}
                    onChange={(e) => updateSsh({ execTimeoutMin: parseInt(e.target.value || '10', 10) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Exec Timeout (sec)</label>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={securityConfig.deviceAccess.ssh.execTimeoutSec ?? 0}
                    onChange={(e) => updateSsh({ execTimeoutSec: parseInt(e.target.value || '0', 10) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600">Enable SSH to configure domain name, RSA, VTY, and timeouts.</p>
            )}
          </div>
        </div>
      </div>

      {/* ACLs */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-slate-800">Access Control Lists (ACLs)</h3>

        {/* Standard ACLs */}
        <div className="border rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-slate-800">Standard ACLs</h4>
            <button onClick={addStandardAcl} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">
              Add Standard ACL
            </button>
          </div>

          {securityConfig.standardAcls.map((acl, index) => (
            <div key={index} className="border rounded p-3 mb-3 bg-white">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <label className="text-sm">Number (1-99):</label>
                  <input
                    type="number"
                    value={acl.number}
                    onChange={(e) => {
                      const updated = [...securityConfig.standardAcls]
                      updated[index] = { ...updated[index], number: parseInt(e.target.value, 10) }
                      push({ ...securityConfig, standardAcls: updated })
                    }}
                    className="w-24 px-2 py-1 border rounded"
                  />
                </div>
                <button onClick={() => removeStandardAcl(index)} className="px-2 py-1 bg-red-600 text-white rounded text-sm">
                  Remove ACL
                </button>
              </div>

              {/* Entries */}
              <div className="pl-4 border-l-2 border-slate-100 space-y-2">
                  <p className="text-xs font-semibold text-slate-500">Entries</p>
                  {acl.entries.map((entry, eIdx) => (
                      <div key={eIdx} className="flex gap-2 items-center text-sm">
                          <select value={entry.action} onChange={(e) => updateStandardEntry(index, eIdx, {action: e.target.value})} className="border rounded px-1">
                              <option value="permit">permit</option>
                              <option value="deny">deny</option>
                          </select>
                          <input type="text" value={entry.source} onChange={(e) => updateStandardEntry(index, eIdx, {source: e.target.value})} className="border rounded px-2 w-32" placeholder="source IP/any" />
                          <input type="text" value={entry.wildcard || ''} onChange={(e) => updateStandardEntry(index, eIdx, {wildcard: e.target.value})} className="border rounded px-2 w-32" placeholder="wildcard (optional)" />
                      </div>
                  ))}
                  <button onClick={() => addStandardEntry(index)} className="text-xs text-blue-600 hover:underline">+ Add Rule</button>
              </div>
            </div>
          ))}
        </div>

        {/* Extended ACLs */}
        <div className="border rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-slate-800">Extended ACLs</h4>
            <button onClick={addExtendedAcl} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">
              Add Extended ACL
            </button>
          </div>

          {securityConfig.extendedAcls.map((acl, index) => (
            <div key={index} className="border rounded p-3 mb-3 bg-white">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <label className="text-sm">Name/Number:</label>
                  <input
                    type="text"
                    value={acl.numberOrName}
                    onChange={(e) => {
                      const updated = [...securityConfig.extendedAcls]
                      updated[index] = { ...updated[index], numberOrName: e.target.value }
                      push({ ...securityConfig, extendedAcls: updated })
                    }}
                    className="w-40 px-2 py-1 border rounded"
                  />
                </div>
                <button onClick={() => removeExtendedAcl(index)} className="px-2 py-1 bg-red-600 text-white rounded text-sm">
                  Remove ACL
                </button>
              </div>

               {/* Entries */}
               <div className="pl-4 border-l-2 border-slate-100 space-y-2">
                  <p className="text-xs font-semibold text-slate-500">Entries</p>
                  {acl.entries.map((entry, eIdx) => (
                      <div key={eIdx} className="grid grid-cols-6 gap-2 items-center text-sm">
                          <select value={entry.action} onChange={(e) => updateExtendedEntry(index, eIdx, {action: e.target.value})} className="border rounded px-1">
                              <option value="permit">permit</option>
                              <option value="deny">deny</option>
                          </select>
                          <select value={entry.protocol} onChange={(e) => updateExtendedEntry(index, eIdx, {protocol: e.target.value})} className="border rounded px-1">
                              <option value="ip">ip</option>
                              <option value="tcp">tcp</option>
                              <option value="udp">udp</option>
                              <option value="icmp">icmp</option>
                              <option value="gre">gre</option>
                              <option value="esp">esp</option>
                          </select>
                          <input type="text" value={entry.source} onChange={(e) => updateExtendedEntry(index, eIdx, {source: e.target.value})} className="border rounded px-2" placeholder="Src (any/host)" />
                          <input type="text" value={entry.destination} onChange={(e) => updateExtendedEntry(index, eIdx, {destination: e.target.value})} className="border rounded px-2" placeholder="Dst (any/host)" />
                          <input type="text" value={entry.port || ''} onChange={(e) => updateExtendedEntry(index, eIdx, {port: e.target.value})} className="border rounded px-2" placeholder="eq 80 (opt)" />
                      </div>
                  ))}
                  <button onClick={() => addExtendedEntry(index)} className="text-xs text-blue-600 hover:underline">+ Add Rule</button>
              </div>
            </div>
          ))}
        </div>

        {/* ACL Applications */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-slate-800">ACL Applications</h4>
            <button onClick={addAclApplication} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">
              Add Application
            </button>
          </div>

          {securityConfig.aclApplications.map((app, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end border-b pb-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Interface</label>
                <input
                  type="text"
                  value={app.interface}
                  onChange={(e) => {
                    const updated = [...securityConfig.aclApplications]
                    updated[index] = { ...updated[index], interface: e.target.value }
                    push({ ...securityConfig, aclApplications: updated })
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">ACL</label>
                <input
                  type="text"
                  value={app.acl}
                  onChange={(e) => {
                    const updated = [...securityConfig.aclApplications]
                    updated[index] = { ...updated[index], acl: e.target.value }
                    push({ ...securityConfig, aclApplications: updated })
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Direction</label>
                <select
                  value={app.direction}
                  onChange={(e) => {
                    const updated = [...securityConfig.aclApplications]
                    updated[index] = { ...updated[index], direction: e.target.value }
                    push({ ...securityConfig, aclApplications: updated })
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                >
                  <option value="in">in</option>
                  <option value="out">out</option>
                </select>
              </div>
              <button
                onClick={() => removeAclApplication(index)}
                className="px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* --- IPsec VPN Configuration (Routers Only) --- */}
      {isRouter && (
      <div className="pt-6 border-t border-slate-300">
        <h3 className="text-lg font-semibold mb-4 text-slate-800">IPsec VPN</h3>

        {/* Phase 1: ISAKMP Policies */}
        <div className="border rounded-lg p-4 mb-6 bg-slate-50">
          <div className="flex items-center justify-between mb-4">
             <div>
                <h4 className="font-medium text-slate-800">Phase 1: ISAKMP Policies</h4>
                <p className="text-xs text-slate-500">Defines how to negotiate the IKE SA.</p>
             </div>
             <button onClick={addPhase1} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Add Policy</button>
          </div>
          {securityConfig.ipsecPhase1.map((p1, idx) => (
             <div key={idx} className="grid md:grid-cols-7 gap-2 items-end border-b border-slate-200 pb-2 mb-2">
                <div>
                   <label className="block text-[10px] uppercase text-slate-500">ID</label>
                   <input type="number" value={p1.policyId} onChange={(e) => updatePhase1(idx, {policyId: Number(e.target.value)})} className="w-full px-2 py-1 border rounded text-xs" />
                </div>
                <div>
                   <label className="block text-[10px] uppercase text-slate-500">Encr</label>
                   <select value={p1.encryption} onChange={(e) => updatePhase1(idx, {encryption: e.target.value as any})} className="w-full px-2 py-1 border rounded text-xs">
                     <option value="aes">AES</option>
                     <option value="3des">3DES</option>
                     <option value="des">DES</option>
                   </select>
                </div>
                <div>
                   <label className="block text-[10px] uppercase text-slate-500">Hash</label>
                   <select value={p1.hash} onChange={(e) => updatePhase1(idx, {hash: e.target.value as any})} className="w-full px-2 py-1 border rounded text-xs">
                     <option value="sha">SHA</option>
                     <option value="md5">MD5</option>
                     <option value="sha256">SHA256</option>
                   </select>
                </div>
                <div>
                   <label className="block text-[10px] uppercase text-slate-500">Auth</label>
                   <select value={p1.authentication} onChange={(e) => updatePhase1(idx, {authentication: e.target.value as any})} className="w-full px-2 py-1 border rounded text-xs">
                     <option value="pre-share">Pre-share</option>
                     <option value="rsa-encr">RSA</option>
                   </select>
                </div>
                <div>
                   <label className="block text-[10px] uppercase text-slate-500">Group</label>
                   <select value={p1.group} onChange={(e) => updatePhase1(idx, {group: Number(e.target.value)})} className="w-full px-2 py-1 border rounded text-xs">
                     <option value={1}>1</option>
                     <option value={2}>2</option>
                     <option value={5}>5</option>
                     <option value={14}>14</option>
                   </select>
                </div>
                <div>
                   <label className="block text-[10px] uppercase text-slate-500">Key</label>
                   <input type="text" value={p1.key} onChange={(e) => updatePhase1(idx, {key: e.target.value})} className="w-full px-2 py-1 border rounded text-xs" />
                </div>
                <button onClick={() => removePhase1(idx)} className="text-red-500 text-xs hover:underline">Remove</button>
             </div>
          ))}
        </div>

        {/* Phase 2: Transform Sets */}
        <div className="border rounded-lg p-4 mb-6 bg-slate-50">
          <div className="flex items-center justify-between mb-4">
             <div>
                <h4 className="font-medium text-slate-800">Phase 2: Transform Sets</h4>
                <p className="text-xs text-slate-500">Defines encryption/hashing for the IPsec SA.</p>
             </div>
             <button onClick={addPhase2} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Add Set</button>
          </div>
          {securityConfig.ipsecPhase2.map((p2, idx) => (
             <div key={idx} className="grid md:grid-cols-4 gap-2 items-end border-b border-slate-200 pb-2 mb-2">
                <div>
                   <label className="block text-[10px] uppercase text-slate-500">Name</label>
                   <input type="text" value={p2.name} onChange={(e) => updatePhase2(idx, {name: e.target.value})} className="w-full px-2 py-1 border rounded text-xs" />
                </div>
                <div className="col-span-1">
                   <label className="block text-[10px] uppercase text-slate-500">Protocol</label>
                   <input type="text" value={p2.protocol} onChange={(e) => updatePhase2(idx, {protocol: e.target.value})} className="w-full px-2 py-1 border rounded text-xs" placeholder="esp-aes esp-sha-hmac" />
                </div>
                <div>
                   <label className="block text-[10px] uppercase text-slate-500">Mode</label>
                   <select value={p2.mode} onChange={(e) => updatePhase2(idx, {mode: e.target.value as any})} className="w-full px-2 py-1 border rounded text-xs">
                     <option value="tunnel">Tunnel</option>
                     <option value="transport">Transport</option>
                   </select>
                </div>
                <button onClick={() => removePhase2(idx)} className="text-red-500 text-xs hover:underline">Remove</button>
             </div>
          ))}
        </div>

        {/* Crypto Maps */}
        <div className="border rounded-lg p-4 bg-slate-50">
          <div className="flex items-center justify-between mb-4">
             <div>
                <h4 className="font-medium text-slate-800">Crypto Maps</h4>
                <p className="text-xs text-slate-500">Binds Peers, Transform Sets, and ACLs. Apply this map to an Interface.</p>
             </div>
             <button onClick={addMap} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">Add Map</button>
          </div>
          {securityConfig.ipsecMaps.map((map, idx) => (
             <div key={idx} className="border border-slate-300 rounded p-2 mb-2 bg-white">
                <div className="grid md:grid-cols-5 gap-2 items-end mb-2">
                    <div>
                        <label className="block text-[10px] uppercase text-slate-500">Map Name</label>
                        <input type="text" value={map.name} onChange={(e) => updateMap(idx, {name: e.target.value})} className="w-full px-2 py-1 border rounded text-xs" />
                    </div>
                    <div>
                        <label className="block text-[10px] uppercase text-slate-500">Priority</label>
                        <input type="number" value={map.priority} onChange={(e) => updateMap(idx, {priority: Number(e.target.value)})} className="w-full px-2 py-1 border rounded text-xs" />
                    </div>
                    <div>
                        <label className="block text-[10px] uppercase text-slate-500">Peer IP</label>
                        <input type="text" value={map.peerIp} onChange={(e) => updateMap(idx, {peerIp: e.target.value})} className="w-full px-2 py-1 border rounded text-xs" placeholder="Remote Tunnel IP" />
                    </div>
                    <div>
                         <label className="block text-[10px] uppercase text-slate-500">Transform Set</label>
                         <input type="text" value={map.transformSet} onChange={(e) => updateMap(idx, {transformSet: e.target.value})} className="w-full px-2 py-1 border rounded text-xs" />
                    </div>
                    <div className="flex justify-end">
                        <button onClick={() => removeMap(idx)} className="text-red-500 text-xs hover:underline">Remove</button>
                    </div>
                </div>
                <div>
                     <label className="block text-[10px] uppercase text-slate-500">Match Address (ACL Name)</label>
                     <input type="text" value={map.matchAcl} onChange={(e) => updateMap(idx, {matchAcl: e.target.value})} className="w-full px-2 py-1 border rounded text-xs" placeholder="e.g. VPN_TRAFFIC_ACL" />
                </div>
             </div>
          ))}
        </div>

      </div>
      )}

    </div>
  )
}