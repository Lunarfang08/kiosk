import { create } from 'zustand'

export type AvatarEngineType = 'portrait' | 'livetalking' | 'musetalk' | 'three_d'

export type AvatarConfig = {
  id: string
  name: string
  engine: AvatarEngineType
  image_path?: string | null
  video_path?: string | null
  model_path?: string | null
  idle_animation: string
  talking_animation: string
  speaking_speed: number
  expression_intensity: number
  lip_sync_sensitivity: number
  background: string
  avatar_scale: number
  camera_framing: string
  voice_selection: string
  language: string
  default_greeting: string
}

type AvatarStore = {
  avatars: AvatarConfig[]
  activeAvatarId: string | null
  mouthOpen: number
  attentive: boolean
  thinking: boolean
  setAvatars: (avatars: AvatarConfig[]) => void
  setActiveAvatarId: (id: string | null) => void
  setMouthOpen: (v: number) => void
  setAttentive: (v: boolean) => void
  setThinking: (v: boolean) => void
  activeAvatar: () => AvatarConfig | null
}

export const useAvatarStore = create<AvatarStore>((set, get) => ({
  avatars: [],
  activeAvatarId: localStorage.getItem('kiosk_active_avatar'),
  mouthOpen: 0,
  attentive: false,
  thinking: false,
  setAvatars: (avatars) => set({ avatars }),
  setActiveAvatarId: (id) => {
    if (id) localStorage.setItem('kiosk_active_avatar', id)
    else localStorage.removeItem('kiosk_active_avatar')
    set({ activeAvatarId: id })
  },
  setMouthOpen: (mouthOpen) => set({ mouthOpen }),
  setAttentive: (attentive) => set({ attentive }),
  setThinking: (thinking) => set({ thinking }),
  activeAvatar: () => {
    const { avatars, activeAvatarId } = get()
    return avatars.find((a) => a.id === activeAvatarId) || avatars[0] || null
  },
}))
