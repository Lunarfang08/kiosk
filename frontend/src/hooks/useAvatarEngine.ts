import { useAvatarStore } from '@/stores/avatarStore'
import { useSessionStore } from '@/stores/sessionStore'

export function useAvatarEngineVisuals() {
  const state = useSessionStore((s) => s.state)
  const mouthOpen = useAvatarStore((s) => s.mouthOpen)
  const attentive = useAvatarStore((s) => s.attentive)
  const thinking = useAvatarStore((s) => s.thinking)
  const avatar = useAvatarStore((s) => s.activeAvatar())

  return {
    avatar,
    mouthOpen,
    attentive: attentive || state === 'listening',
    thinking: thinking || state === 'processing',
    speaking: state === 'speaking',
    idle: state === 'idle',
    state,
  }
}
