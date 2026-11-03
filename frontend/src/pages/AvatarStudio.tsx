import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/services/api'
import { avatarAssetUrl } from '@/services/avatarService'
import type { AvatarConfig, AvatarEngineType } from '@/stores/avatarStore'
import { useAvatarStore } from '@/stores/avatarStore'
import { Button } from '@/components/ui/button'

const ENGINE_HELP: Record<AvatarEngineType, string> = {
  portrait: 'Audio-driven talking portrait (Mac demo). Not a full 3D model.',
  livetalking: 'LiveTalking CUDA engine (GPU server). Uses /offer + /humanaudio.',
  musetalk: 'MuseTalk quality via LiveTalking --model musetalk (strong GPU).',
  three_d: 'GLB/GLTF/VRM with morph targets. Without morphs, lip-sync is limited.',
}

export function AvatarStudio() {
  const { avatars, setAvatars, activeAvatarId, setActiveAvatarId } = useAvatarStore()
  const [name, setName] = useState('Receptionist')
  const [engine, setEngine] = useState<AvatarEngineType>('portrait')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [token, setToken] = useState(localStorage.getItem('kiosk_admin_token') || '')

  const refresh = async () => {
    const list = (await api.avatars()) as AvatarConfig[]
    setAvatars(list)
  }

  useEffect(() => {
    void refresh().catch((e) => setMessage(String(e)))
  }, [])

  const saveToken = () => {
    localStorage.setItem('kiosk_admin_token', token)
    setMessage('Admin token saved locally for studio/settings calls only.')
  }

  const create = async () => {
    setBusy(true)
    try {
      const created = (await api.createAvatar({
        name,
        engine,
        default_greeting:
          "Hello! Welcome. I'm your AI assistant. How can I help you today?",
      })) as AvatarConfig
      await refresh()
      setActiveAvatarId(created.id)
      setMessage(`Created avatar ${created.name}`)
    } catch (e) {
      setMessage(String(e))
    } finally {
      setBusy(false)
    }
  }

  const upload = async (file: File, kind: string, avatarId: string) => {
    setBusy(true)
    try {
      await api.uploadAvatar(file, kind, avatarId)
      await refresh()
      setMessage(`Uploaded ${kind} for avatar`)
    } catch (e) {
      setMessage(String(e))
    } finally {
      setBusy(false)
    }
  }

  const testSample = async (avatar: AvatarConfig) => {
    // Sample tone via Web Audio to verify mouth overlay path
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 180
    gain.gain.value = 0.05
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    useAvatarStore.getState().setMouthOpen(0.7)
    setTimeout(() => {
      osc.stop()
      void ctx.close()
      useAvatarStore.getState().setMouthOpen(0)
      setMessage(`Sample animation tested for ${avatar.name}`)
    }, 900)
  }

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-5 py-8">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <Link to="/" className="text-sm text-[var(--color-muted)] hover:text-ink">
            ← Kiosk
          </Link>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
            Avatar Studio
          </h1>
          <p className="mt-2 max-w-2xl text-[var(--color-muted)]">
            Create a digital human. Portrait-based talking avatars are prioritized for the Mac
            demo. Static portraits, audio-driven talking portraits, and full 3D models are kept
            distinct.
          </p>
        </div>
      </div>

      <section className="mb-8 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-muted)]">
          Admin token
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="h-11 min-w-[240px] flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel-2)] px-3"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ADMIN_TOKEN"
            type="password"
          />
          <Button variant="secondary" onClick={saveToken}>
            Save
          </Button>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
        <h2 className="text-lg font-semibold">Create avatar</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Name
            <input
              className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-panel-2)] px-3"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Animation engine
            <select
              className="mt-1 h-11 w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-panel-2)] px-3"
              value={engine}
              onChange={(e) => setEngine(e.target.value as AvatarEngineType)}
            >
              <option value="portrait">Audio-driven talking portrait</option>
              <option value="three_d">3D avatar (GLB/GLTF/VRM)</option>
              <option value="livetalking">LiveTalking (GPU)</option>
              <option value="musetalk">MuseTalk via LiveTalking (GPU)</option>
            </select>
          </label>
        </div>
        <p className="mt-2 text-sm text-[var(--color-muted)]">{ENGINE_HELP[engine]}</p>
        <Button className="mt-4" disabled={busy} onClick={() => void create()}>
          Create & save
        </Button>
      </section>

      <section className="space-y-4">
        {avatars.map((avatar) => {
          const active = avatar.id === activeAvatarId
          return (
            <div
              key={avatar.id}
              className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex gap-4">
                  <div className="h-28 w-24 overflow-hidden rounded-xl bg-black/40">
                    {avatar.image_path ? (
                      <img
                        src={avatarAssetUrl(avatar.image_path) || ''}
                        alt={avatar.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-[var(--color-muted)]">
                        No image
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{avatar.name}</h3>
                    <p className="text-sm text-[var(--color-muted)]">
                      {avatar.engine} · {ENGINE_HELP[avatar.engine]}
                    </p>
                    {active && (
                      <span className="mt-2 inline-block text-xs uppercase tracking-wider text-[var(--color-accent)]">
                        Active on kiosk
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setActiveAvatarId(avatar.id)}>
                    Use in kiosk
                  </Button>
                  <Button variant="ghost" onClick={() => void testSample(avatar)}>
                    Test sample
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() =>
                      void api.deleteAvatar(avatar.id).then(refresh).catch((e) => setMessage(String(e)))
                    }
                  >
                    Delete
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <label className="text-sm">
                  Upload portrait (PNG/JPG/WebP)
                  <input
                    className="mt-1 block w-full text-sm"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void upload(f, 'image', avatar.id)
                    }}
                  />
                </label>
                <label className="text-sm">
                  Upload talking video (for LiveTalking prep)
                  <input
                    className="mt-1 block w-full text-sm"
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void upload(f, 'video', avatar.id)
                    }}
                  />
                </label>
                <label className="text-sm">
                  Upload 3D model (GLB/GLTF/VRM)
                  <input
                    className="mt-1 block w-full text-sm"
                    type="file"
                    accept=".glb,.gltf,.vrm"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void upload(f, 'model', avatar.id)
                    }}
                  />
                </label>
              </div>
            </div>
          )
        })}
        {!avatars.length && (
          <p className="text-[var(--color-muted)]">No avatars yet — create one above.</p>
        )}
      </section>

      {message && (
        <p className="mt-6 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm">
          {message}
        </p>
      )}
    </div>
  )
}
