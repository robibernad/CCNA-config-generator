import { useSessionStore } from '@/lib/store/session'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'

class ApiClient {
  private sessionId: string | null = null

  setSessionId(id: string | null) {
    console.log('🔧 API Client: setSessionId called with:', id)
    this.sessionId = id
    console.log('🔧 API Client: sessionId is now:', this.sessionId)
  }

  private getSessionIdFallback(): string | null {
    // 1) Zustand store (safe, no hooks)
    try {
      const sid = useSessionStore.getState().sessionId
      if (sid) return sid
    } catch {}

    // 2) Persisted Zustand storage
    try {
      if (typeof window === 'undefined') return null
      const raw = window.localStorage.getItem('ccna-session')
      if (!raw) return null

      const parsed = JSON.parse(raw)
      // Zustand persist format: { state: {...}, version: n }
      const sid = parsed?.state?.sessionId
      return sid ?? null
    } catch {
      return null
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    }

    const sid = this.sessionId ?? this.getSessionIdFallback()
    if (sid) {
      ;(headers as any)['X-Session-ID'] = sid
    }

    const fullUrl = `${API_URL}${endpoint}`
    console.log('🔗 Making request to:', fullUrl)
    console.log('🔑 Session ID:', sid ? 'Present' : 'Missing')

    const response = await fetch(fullUrl, {
      ...options,
      headers,
    })

    console.log('📊 Response status:', response.status, response.statusText)

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ detail: 'Request failed' }))
      const detail = (payload as any)?.detail
      console.error('❌ Request failed. Payload:', payload)

      const message =
        typeof detail === 'string'
          ? detail
          : detail
          ? JSON.stringify(detail, null, 2)
          : `HTTP ${response.status}`

      throw new Error(message)
    }

    const text = await response.text()
    return (text ? JSON.parse(text) : ({} as any)) as T
  }

  // Session
  async createSession(params: any) {
    return this.request<any>('/session', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  // Projects
  async getProjects() {
    return this.request<any[]>('/gns3/projects')
  }

  async getProjectInventory(projectId: string) {
    return this.request<any>(`/gns3/projects/${projectId}/inventory`)
  }

  // Config
  async generateConfig(intendedConfig: any) {
    return this.request<any>('/config/generate', {
      method: 'POST',
      body: JSON.stringify({ intendedConfig }),
    })
  }

  // Devices
  async executeCommand(deviceId: string, command: string) {
    return this.request<any>(`/devices/${deviceId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ command }),
    })
  }

  async applyConfig(deviceId: string, commands: string[], saveConfig: boolean = true) {
    return this.request<any>(`/devices/${deviceId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ commands, saveConfig }),
    })
  }

  async showRunningConfig(deviceId: string, projectId: string) {
    console.log('🌐 API Client: showRunningConfig called with deviceId:', deviceId, 'projectId:', projectId)
    const endpoint = `/devices/${deviceId}/show-running-config?project_id=${projectId}`
    console.log('🌐 API Client: endpoint:', endpoint)
    return this.request<any>(endpoint, {
      method: 'GET',
    })
  }

  // Verify
  async runVerification(deviceId: string, pack: string) {
    return this.request<any>('/verify/run', {
      method: 'POST',
      body: JSON.stringify({ deviceId, pack }),
    })
  }
}

export const apiClient = new ApiClient()
