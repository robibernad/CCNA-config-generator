'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useSessionStore } from '@/lib/store/session'
import { apiClient } from '@/lib/api/client'
import { DeviceConfigurator } from '@/components/configurator/device-configurator'

interface Project {
  projectId: string
  name: string
  status: string
}

interface Device {
  nodeId: string
  name: string
  deviceType: string
  status: string
  interfaces: Array<{
    name: string
    connected: boolean
    connectedTo?: string
  }>
}

export default function ProjectPage() {
  const router = useRouter()
  const { sessionId, hasHydrated } = useSessionStore()

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [projectSearch, setProjectSearch] = useState('')
  const [deviceSearch, setDeviceSearch] = useState('')

  useEffect(() => {
    // Wait for Zustand persist rehydration before deciding redirect
    if (!hasHydrated) return

    if (!sessionId) {
      router.push('/')
      return
    }

    loadProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated, sessionId, router])

  const loadProjects = async () => {
    try {
      setLoading(true)
      const data = await apiClient.getProjects()
      setProjects(data)
      setError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const loadInventory = async (projectId: string) => {
    try {
      setLoading(true)
      const data = await apiClient.getProjectInventory(projectId)
      setDevices(data.devices)
      setSelectedProject(projectId)
      setSelectedDevice(null)
      setDeviceSearch('')
      setError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase()
    const list = q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [projects, projectSearch])

  const filteredDevices = useMemo(() => {
    const q = deviceSearch.trim().toLowerCase()
    const list = q ? devices.filter((d) => d.name.toLowerCase().includes(q)) : devices
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [devices, deviceSearch])

  // While rehydrating, show a minimal loading state
  if (!hasHydrated) {
    return (
      <div className="text-center py-12 text-slate-500">
        Loading session...
      </div>
    )
  }

  // After hydration, if no session, redirect happens in effect; render nothing
  if (!sessionId) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Project Selection */}
      {!selectedDevice && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">
            {selectedProject ? 'Select a Device' : 'Select a Project'}
          </h2>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading...</div>
          ) : !selectedProject ? (
            <div>
              {/* Project Search */}
              <div className="mb-4">
                <input
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="Search projects..."
                  className="w-full md:w-96 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <div className="text-xs text-slate-500 mt-1">
                  Showing {filteredProjects.length} / {projects.length}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map((project) => (
                  <button
                    key={project.projectId}
                    onClick={() => loadInventory(project.projectId)}
                    className="p-4 border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                  >
                    <h3 className="font-semibold text-slate-800">{project.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Status:{' '}
                      <span
                        className={
                          project.status === 'opened'
                            ? 'text-green-600'
                            : 'text-slate-400'
                        }
                      >
                        {project.status}
                      </span>
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <button
                onClick={() => {
                  setSelectedProject(null)
                  setDevices([])
                  setSelectedDevice(null)
                  setDeviceSearch('')
                }}
                className="text-blue-600 hover:text-blue-800 mb-4"
              >
                ← Back to Projects
              </button>

              {/* Device Search */}
              <div className="mb-4">
                <input
                  value={deviceSearch}
                  onChange={(e) => setDeviceSearch(e.target.value)}
                  placeholder="Search devices..."
                  className="w-full md:w-96 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <div className="text-xs text-slate-500 mt-1">
                  Showing {filteredDevices.length} / {devices.length}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDevices.map((device) => (
                  <button
                    key={device.nodeId}
                    onClick={() => setSelectedDevice(device)}
                    className="p-4 border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">
                        {device.deviceType === 'router'
                          ? '🔀'
                          : device.deviceType === 'switch'
                          ? '🔲'
                          : '💻'}
                      </span>
                      <div>
                        <h3 className="font-semibold text-slate-800">{device.name}</h3>
                        <p className="text-sm text-slate-500">{device.deviceType}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                      {device.interfaces.filter((i) => i.connected).length} /{' '}
                      {device.interfaces.length} interfaces connected
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Device Configurator */}
      {selectedDevice && (
        <div>
          <button
            onClick={() => setSelectedDevice(null)}
            className="text-blue-600 hover:text-blue-800 mb-4"
          >
            ← Back to Devices
          </button>

          <DeviceConfigurator device={selectedDevice} />
        </div>
      )}
    </div>
  )
}
