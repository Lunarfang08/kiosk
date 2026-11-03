import type { AvatarConfig } from '@/stores/avatarStore'
import { apiBase } from '@/lib/utils'

export function avatarAssetUrl(path?: string | null): string | null {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
    return path
  }
  if (path.startsWith('/')) return `${apiBase()}${path}`
  return `${apiBase()}/${path}`
}

export type AvatarEngineHandle = {
  initialize: () => Promise<void>
  loadAvatar: (avatar: AvatarConfig | null) => Promise<void>
  startSession: () => Promise<void>
  processAudioLevel: (level: number, speaking: boolean) => void
  stopSession: () => Promise<void>
  getStatus: () => { engine: string; speaking: boolean }
  dispose: () => void
}

export function createPortraitEngine(
  onMouth: (open: number) => void,
): AvatarEngineHandle {
  let speaking = false
  let sensitivity = 1
  let smoothed = 0
  let rafSmooth = 0

  return {
    async initialize() {},
    async loadAvatar(avatar) {
      sensitivity = avatar?.lip_sync_sensitivity ?? 1.35
    },
    async startSession() {},
    processAudioLevel(level, isSpeaking) {
      speaking = isSpeaking || level > 0.06
      // Keep a floor while TTS is active so the jaw never freezes mid-sentence
      const raw = speaking
        ? Math.min(1, Math.max(level, isSpeaking ? 0.18 : 0) * sensitivity * 1.6)
        : 0
      // Attack fast / release slower for natural lip motion
      const alpha = raw > smoothed ? 0.55 : 0.22
      smoothed = smoothed * (1 - alpha) + raw * alpha
      if (!speaking) smoothed *= 0.7
      onMouth(smoothed < 0.02 && !speaking ? 0 : smoothed)
      cancelAnimationFrame(rafSmooth)
      if (!speaking && smoothed > 0.01) {
        rafSmooth = requestAnimationFrame(() => {
          smoothed *= 0.6
          onMouth(smoothed < 0.02 ? 0 : smoothed)
        })
      }
    },
    async stopSession() {
      speaking = false
      smoothed = 0
      onMouth(0)
    },
    getStatus: () => ({ engine: 'portrait', speaking }),
    dispose() {
      speaking = false
      smoothed = 0
      onMouth(0)
      cancelAnimationFrame(rafSmooth)
    },
  }
}
