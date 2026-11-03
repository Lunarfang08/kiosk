import { useSessionStore } from '@/stores/sessionStore'

export function useAudioStream() {
  return useSessionStore((s) => s.remoteStream)
}
