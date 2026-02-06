import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { apiClient } from '@/lib/api/client'

interface Session {
  sessionId: string
  serverUrl: string
  hasGns3Auth: boolean
  deviceUsername: string
  deviceTransport: string
}

interface CreateSessionParams {
  serverUrl: string
  gns3Auth?: {
    username: string
    password: string
  }
  deviceCredentials: {
    username: string
    password: string
    enableSecret?: string
    transport: string
  }
}

interface SessionStore {
  session: Session | null
  sessionId: string | null
  isLoading: boolean
  error: string | null

  // NEW: hydration flag to avoid redirecting before persist rehydrates
  hasHydrated: boolean
  setHasHydrated: (v: boolean) => void

  createSession: (params: CreateSessionParams) => Promise<Session | null>
  clearSession: () => void
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      session: null,
      sessionId: null,
      isLoading: false,
      error: null,

      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),

      createSession: async (params) => {
        set({ isLoading: true, error: null })

        try {
          const session = await apiClient.createSession(params)

          set({
            session,
            sessionId: session.sessionId,
            isLoading: false,
          })

          // Store session ID in API client (for X-Session-ID header)
          apiClient.setSessionId(session.sessionId)

          return session
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Failed to create session',
            isLoading: false,
          })
          return null
        }
      },

      clearSession: () => {
        set({
          session: null,
          sessionId: null,
          error: null,
        })
        apiClient.setSessionId(null)
      },
    }),
    {
      name: 'ccna-session',

      // Persist only what we need across refresh
      partialize: (state) => ({
        sessionId: state.sessionId,
      }),

      // Called when Zustand rehydrates from storage
      onRehydrateStorage: () => (state) => {
        console.log('🔄 Zustand rehydrating from storage...')
        console.log('📦 Rehydrated sessionId:', state?.sessionId)

        // mark hydration complete
        state?.setHasHydrated(true)

        // restore api client session id if present
        if (state?.sessionId) {
          console.log('✅ Setting sessionId in API client:', state.sessionId)
          apiClient.setSessionId(state.sessionId)
        } else {
          console.log('⚠️ No sessionId found in rehydrated state')
          apiClient.setSessionId(null)
        }
      },
    }
  )
)
