import { useSessionStore } from '@/stores/sessionStore'

export function TranscriptPanel() {
  const transcript = useSessionStore((s) => s.transcript)
  if (!transcript.length) return null
  return (
    <div className="max-h-36 w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-black/35 p-3 backdrop-blur-md">
      <div className="space-y-2 text-sm">
        {transcript.slice(-8).map((t) => (
          <div key={t.id} className="leading-snug">
            <span className="mr-2 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              {t.role}
            </span>
            <span className={t.role === 'assistant' ? 'text-cyan-100' : 'text-ink'}>
              {t.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
