'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSessionStore } from '@/lib/store/session'

export default function HomePage() {
  const router = useRouter()
  const { createSession, isLoading, error } = useSessionStore()

  const [serverUrl, setServerUrl] = useState('')
  const [gns3Username, setGns3Username] = useState('')
  const [gns3Password, setGns3Password] = useState('')
  const [deviceUsername, setDeviceUsername] = useState('cisco')
  const [devicePassword, setDevicePassword] = useState('cisco')
  const [enableSecret, setEnableSecret] = useState('cisco')
  const [transport, setTransport] = useState('telnet')
  const [connectionError, setConnectionError] = useState<string | null>(null)

  const normalizeServerUrl = (raw: string) => {
    const v = raw.trim()
    // common mistake: users paste a web-ui deep link; keep only origin
    try {
      const u = new URL(v)
      return `${u.protocol}//${u.host}`
    } catch {
      return v
    }
  }

  const handleConnect = async () => {
    if (!serverUrl.trim()) {
      setConnectionError('Please enter a GNS3 server URL (e.g., http://192.168.1.100:3080)')
      return
    }

    setConnectionError(null)

    const normalized = normalizeServerUrl(serverUrl)

    const session = await createSession({
      serverUrl: normalized,
      gns3Auth: gns3Username ? { username: gns3Username, password: gns3Password } : undefined,
      deviceCredentials: {
        username: deviceUsername,
        password: devicePassword,
        enableSecret: enableSecret,
        transport: transport,
      },
    })

    if (session) {
      // replace prevents going "Back" to the connect screen and accidentally creating multiple sessions
      router.replace('/project')
    }
  }

  const handleMockMode = async () => {
    setConnectionError(null)

    const session = await createSession({
      serverUrl: 'mock://localhost',
      deviceCredentials: {
        username: 'cisco',
        password: 'cisco',
        enableSecret: 'cisco',
        transport: 'telnet',
      },
    })

    if (session) {
      router.replace('/project')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">
          Connect to GNS3 Server
        </h2>

        {(error || connectionError) && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {connectionError || error}
          </div>
        )}

        <div className="space-y-6">
          {/* GNS3 Server */}
          <div>
            <h3 className="text-lg font-semibold text-slate-700 mb-3">
              GNS3 Server
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">
                  Server URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://192.168.1.100:3080"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Use the base server URL (e.g., http://localhost:3080). If you paste a web-ui link, it will be normalized automatically.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Username (optional)
                  </label>
                  <input
                    type="text"
                    value={gns3Username}
                    onChange={(e) => setGns3Username(e.target.value)}
                    placeholder="admin"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Password (optional)
                  </label>
                  <input
                    type="password"
                    value={gns3Password}
                    onChange={(e) => setGns3Password(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Device Credentials */}
          <div>
            <h3 className="text-lg font-semibold text-slate-700 mb-3">
              Device Credentials
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={deviceUsername}
                    onChange={(e) => setDeviceUsername(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={devicePassword}
                    onChange={(e) => setDevicePassword(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Enable Secret
                  </label>
                  <input
                    type="password"
                    value={enableSecret}
                    onChange={(e) => setEnableSecret(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Transport
                  </label>
                  <select
                    value={transport}
                    onChange={(e) => setTransport(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="telnet">Telnet</option>
                    <option value="ssh">SSH</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={handleConnect}
              disabled={isLoading}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Connecting...' : '🔌 Connect to GNS3'}
            </button>
            <button
              onClick={handleMockMode}
              disabled={isLoading}
              className="flex-1 bg-slate-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              🧪 Use Mock Server
            </button>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">💡 Getting Started</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>Connect to GNS3:</strong> Enter your GNS3 server URL and click "Connect to GNS3"</li>
          <li>• <strong>Mock Server:</strong> Click "Use Mock Server" to test without a real GNS3 server</li>
          <li>• Device credentials are used for Telnet/SSH connections to network devices</li>
        </ul>
      </div>

      {/* Mock Mode Info */}
      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <h3 className="font-semibold text-amber-800 mb-2">🧪 Mock Mode</h3>
        <p className="text-sm text-amber-700">
          Mock mode provides simulated GNS3 projects and devices for testing.
          No real GNS3 server is needed. Great for learning the interface!
        </p>
      </div>
    </div>
  )
}
