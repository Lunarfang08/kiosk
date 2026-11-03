import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/services/api'
import { useSessionStore } from '@/stores/sessionStore'

export function DiagnosticsPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const metrics = useSessionStore((s) => s.metrics)
  const state = useSessionStore((s) => s.state)
  const sessionId = useSessionStore((s) => s.sessionId)

  useEffect(() => {
    const tick = () => {
      void api
        .diagnostics()
        .then((d) => setData(d as Record<string, unknown>))
        .catch(() => undefined)
    }
    tick()
    const id = setInterval(tick, 4000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-5 py-8">
      <Link to="/" className="text-sm text-[var(--color-muted)] hover:text-ink">
        ← Kiosk
      </Link>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold">
        Diagnostics
      </h1>
      <p className="mt-2 text-[var(--color-muted)]">
        Measure latency rather than assuming it. LiveTalking GPU metrics appear when that profile
        is enabled.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          ['Session state', state],
          ['Session ID', sessionId || '—'],
          ['TTFA (ms)', metrics.time_to_first_audio_ms ?? '—'],
          ['First avatar frame', metrics.time_to_first_avatar_frame_ms ?? '—'],
          ['A/V offset (ms)', metrics.av_offset_ms ?? '—'],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-4"
          >
            <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
              {label}
            </div>
            <div className="mt-2 break-all font-[family-name:var(--font-display)] text-xl">
              {String(value)}
            </div>
          </div>
        ))}
      </div>

      <pre className="mt-8 overflow-auto rounded-2xl border border-[var(--color-line)] bg-black/30 p-4 text-xs text-[var(--color-muted)]">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}
