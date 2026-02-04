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

interface SecurityConfig {
  deviceAccess: DeviceAccess
  standardAcls: any[]
  extendedAcls: any[]
  aclApplications: any[]
}

interface Props {
  config?: any
  onUpdate: (config: any) => void
}

export function SecurityTab({ config, onUpdate }: Props) {
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

  const removeStandardAcl = (index: number) => {
    const updated = securityConfig.standardAcls.filter((_, i) => i !== index)
    push({ ...securityConfig, standardAcls: updated })
  }

  const addExtendedAcl = () => {
    const updated = [...securityConfig.extendedAcls, { numberOrName: '100', entries: [] }]
    push({ ...securityConfig, extendedAcls: updated })
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
            <div key={index} className="border rounded p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <label className="text-sm">Number:</label>
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
                  Remove
                </button>
              </div>
              <p className="text-xs text-slate-600">Entry editing stays as-is (use the backend JSON until we add per-entry UI).</p>
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
            <div key={index} className="border rounded p-3 mb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <label className="text-sm">Number/Name:</label>
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
                  Remove
                </button>
              </div>
              <p className="text-xs text-slate-600">Entry editing stays as-is (use the backend JSON until we add per-entry UI).</p>
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
    </div>
  )
}
