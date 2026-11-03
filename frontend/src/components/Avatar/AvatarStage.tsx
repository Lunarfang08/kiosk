import { PortraitAvatar } from '@/components/Avatar/PortraitAvatar'
import { ThreeDAvatar } from '@/components/Avatar/ThreeDAvatar'
import { useAvatarStore } from '@/stores/avatarStore'

export function AvatarStage() {
  const engine = useAvatarStore((s) => s.activeAvatar()?.engine || 'portrait')

  if (engine === 'three_d') return <ThreeDAvatar />
  // livetalking / musetalk: GPU path renders remote WebRTC video when available;
  // Mac demo falls back to portrait lip-sync.
  return <PortraitAvatar />
}
