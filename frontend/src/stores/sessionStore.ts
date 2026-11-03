import { create } from 'zustand'

export type ConversationState =
  | 'idle'
  | 'initializing'
  | 'connecting_to_dograh'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'interrupted'
  | 'reconnecting'
  | 'error'

export type TranscriptItem = {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  final?: boolean
  at: number
}

type SessionStore = {
  state: ConversationState
  sessionId: string | null
  dograhRunId: number | null
  error: string | null
  transcript: TranscriptItem[]
  remoteStream: MediaStream | null
  isFullscreen: boolean
  metrics: Record<string, number | null>
  setState: (state: ConversationState) => void
  setSession: (id: string | null, runId?: number | null) => void
  setError: (error: string | null) => void
  setRemoteStream: (stream: MediaStream | null) => void
  setFullscreen: (v: boolean) => void
  setMetrics: (m: Record<string, number | null>) => void
  pushTranscript: (item: Omit<TranscriptItem, 'id' | 'at'> & { id?: string }) => void
  updateLastAssistant: (text: string, final?: boolean) => void
  resetTranscript: () => void
  reset: () => void
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  state: 'idle',
  sessionId: null,
  dograhRunId: null,
  error: null,
  transcript: [],
  remoteStream: null,
  isFullscreen: false,
  metrics: {
    time_to_first_audio_ms: null,
    time_to_first_avatar_frame_ms: null,
    av_offset_ms: null,
  },
  setState: (state) => set({ state }),
  setSession: (id, runId = null) => set({ sessionId: id, dograhRunId: runId ?? null }),
  setError: (error) => set({ error }),
  setRemoteStream: (remoteStream) => set({ remoteStream }),
  setFullscreen: (isFullscreen) => set({ isFullscreen }),
  setMetrics: (m) => set({ metrics: { ...get().metrics, ...m } }),
  pushTranscript: (item) =>
    set({
      transcript: [
        ...get().transcript,
        {
          id: item.id || crypto.randomUUID(),
          role: item.role,
          text: item.text,
          final: item.final,
          at: Date.now(),
        },
      ].slice(-40),
    }),
  updateLastAssistant: (text, final) => {
    const list = [...get().transcript]
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i].role === 'assistant') {
        list[i] = { ...list[i], text: list[i].text + text, final }
        set({ transcript: list })
        return
      }
    }
    get().pushTranscript({ role: 'assistant', text, final })
  },
  resetTranscript: () => set({ transcript: [] }),
  reset: () =>
    set({
      state: 'idle',
      sessionId: null,
      dograhRunId: null,
      error: null,
      remoteStream: null,
      transcript: [],
    }),
}))
