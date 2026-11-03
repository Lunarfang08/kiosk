import { useCallback, useRef } from 'react'
import { api } from '@/services/api'
import { DograhWebRTCClient, type DograhSessionInfo } from '@/services/dograhService'
import { AudioAnalyserBridge } from '@/services/audioService'
import { createPortraitEngine } from '@/services/avatarService'
import { useAvatarStore } from '@/stores/avatarStore'
import { useSessionStore } from '@/stores/sessionStore'

export function useDograhSession() {
  const clientRef = useRef<DograhWebRTCClient | null>(null)
  const analyserRef = useRef<AudioAnalyserBridge | null>(null)
  const engineRef = useRef(createPortraitEngine((open) => useAvatarStore.getState().setMouthOpen(open)))
  const speakingRef = useRef(false)
  const reconnectAttempts = useRef(0)

  const {
    setState,
    setSession,
    setError,
    setRemoteStream,
    setMetrics,
    pushTranscript,
    updateLastAssistant,
    reset,
  } = useSessionStore()

  const wireRtf = useCallback(
    (msg: Record<string, unknown>) => {
      const type = String(msg.type || '')
      const payload = (msg.payload || msg) as Record<string, unknown>

      if (type === 'rtf-user-transcription') {
        const text = String(payload.text || '')
        const final = Boolean(payload.final)
        if (text) {
          pushTranscript({ role: 'user', text, final })
          if (!final) setState('listening')
          else setState('processing')
        }
      }

      if (type === 'rtf-bot-text') {
        const text = String(payload.text || payload.content || '')
        if (text) updateLastAssistant(text, false)
      }

      if (type === 'rtf-bot-started-speaking') {
        speakingRef.current = true
        setState('speaking')
        useAvatarStore.getState().setThinking(false)
        useAvatarStore.getState().setAttentive(false)
      }

      if (type === 'rtf-bot-stopped-speaking') {
        speakingRef.current = false
        useAvatarStore.getState().setMouthOpen(0)
        engineRef.current.processAudioLevel(0, false)
        setState('listening')
        useAvatarStore.getState().setAttentive(true)
      }

      if (type === 'rtf-pipeline-error') {
        setError(String(payload.message || 'Pipeline error'))
        setState('error')
      }
    },
    [pushTranscript, setError, setState, updateLastAssistant],
  )

  const start = useCallback(async () => {
    try {
      setError(null)
      setState('initializing')
      reset()
      setState('connecting_to_dograh')

      const avatar = useAvatarStore.getState().activeAvatar()
      const session = (await api.startSession({
        avatar_id: avatar?.id,
        engine: avatar?.engine || 'portrait',
      })) as {
        session_id?: string
        state?: string
        error?: string
        dograh_run_id?: number
        dograh?: DograhSessionInfo
        metrics?: Record<string, number | null>
      }

      if (!session.session_id || !session.dograh) {
        throw new Error(session.error || 'Failed to start Dograh session')
      }

      setSession(session.session_id, session.dograh_run_id ?? session.dograh.workflow_run_id)

      await engineRef.current.initialize()
      await engineRef.current.loadAvatar(avatar)
      await engineRef.current.startSession()

      const client = new DograhWebRTCClient()
      clientRef.current = client

      client.onRemoteStream = (stream) => {
        setRemoteStream(stream)
        analyserRef.current?.dispose()
        const bridge = new AudioAnalyserBridge()
        analyserRef.current = bridge
        bridge.onLevel = (level) => {
          const sessionSpeaking = useSessionStore.getState().state === 'speaking'
          const active = speakingRef.current || sessionSpeaking || level > 0.05
          engineRef.current.processAudioLevel(level, active)
          // Fallback: if RTF speaking events missing, infer from audio energy
          if (!speakingRef.current && level > 0.06) {
            speakingRef.current = true
            setState('speaking')
          }
        }
        bridge.attach(stream)
        void bridge.resume()
        setMetrics({ time_to_first_avatar_frame_ms: Math.round(performance.now()) })
      }

      client.onFirstAudio = (ms) => setMetrics({ time_to_first_audio_ms: ms })
      client.onRtf = wireRtf
      client.onConnectionState = (state) => {
        if (state === 'connected') {
          reconnectAttempts.current = 0
          setState('listening')
          useAvatarStore.getState().setAttentive(true)
          pushTranscript({
            role: 'system',
            text: avatar?.default_greeting ||
              "Hello! Welcome. I'm your AI assistant. How can I help you today?",
          })
        } else if (state === 'disconnected' || state === 'failed') {
          setState('reconnecting')
          reconnectAttempts.current += 1
          if (reconnectAttempts.current > 3) {
            setError('Connection lost')
            setState('error')
          }
        }
      }
      client.onError = (err) => {
        setError(err.message)
        setState('error')
      }

      await client.connect(session.dograh)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setState('error')
    }
  }, [
    pushTranscript,
    reset,
    setError,
    setMetrics,
    setRemoteStream,
    setSession,
    setState,
    wireRtf,
  ])

  const stop = useCallback(async () => {
    const sessionId = useSessionStore.getState().sessionId
    speakingRef.current = false
    useAvatarStore.getState().setMouthOpen(0)
    useAvatarStore.getState().setAttentive(false)
    useAvatarStore.getState().setThinking(false)
    analyserRef.current?.dispose()
    analyserRef.current = null
    await engineRef.current.stopSession()
    await clientRef.current?.disconnect()
    clientRef.current = null
    if (sessionId) {
      try {
        await api.stopSession(sessionId)
      } catch {
        /* ignore */
      }
    }
    setRemoteStream(null)
    setState('idle')
  }, [setRemoteStream, setState])

  const interruptSpeaking = useCallback(() => {
    speakingRef.current = false
    useAvatarStore.getState().setMouthOpen(0)
    engineRef.current.processAudioLevel(0, false)
    setState('interrupted')
    setTimeout(() => {
      if (useSessionStore.getState().state === 'interrupted') {
        setState('listening')
        useAvatarStore.getState().setAttentive(true)
      }
    }, 400)
  }, [setState])

  return { start, stop, interruptSpeaking }
}
