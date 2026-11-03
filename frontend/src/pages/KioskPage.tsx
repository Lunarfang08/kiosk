import { Link } from 'react-router-dom'
import { AvatarStage } from '@/components/Avatar/AvatarStage'
import { KioskControls } from '@/components/Controls/KioskControls'
import { StatusBadge } from '@/components/Kiosk/StatusBadge'
import { TranscriptPanel } from '@/components/Kiosk/TranscriptPanel'
import { useAvatarStore } from '@/stores/avatarStore'
import { useSessionStore } from '@/stores/sessionStore'

export function KioskPage() {
  const state = useSessionStore((s) => s.state)
  const error = useSessionStore((s) => s.error)
  const greeting =
    useAvatarStore((s) => s.activeAvatar()?.default_greeting) ||
    "Hello! Welcome. I'm your AI assistant. How can I help you today?"

  return (
    <div className="relative flex h-full min-h-screen flex-col">
      <header className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-5 md:p-8">
        <div>
          <div className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight md:text-3xl">
            Aura
          </div>
          <p className="mt-1 max-w-sm text-sm text-[var(--color-muted)]">
            Digital human receptionist
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge state={state} />
          <nav className="hidden gap-2 text-sm text-[var(--color-muted)] md:flex">
            <Link className="hover:text-ink" to="/studio">
              Studio
            </Link>
            <Link className="hover:text-ink" to="/settings">
              Settings
            </Link>
            <Link className="hover:text-ink" to="/diagnostics">
              Diagnostics
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center px-4 pb-36 pt-24">
        <AvatarStage />
        {state === 'idle' && (
          <p className="mt-6 max-w-xl text-center text-lg text-[var(--color-muted)] md:text-xl">
            {greeting}
          </p>
        )}
        {error && (
          <p className="mt-4 max-w-xl rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-center text-sm text-rose-200">
            {error}
          </p>
        )}
      </main>

      <footer className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-4 p-5 md:p-8">
        <TranscriptPanel />
        <KioskControls />
        <div className="flex gap-4 text-xs text-[var(--color-muted)] md:hidden">
          <Link to="/studio">Studio</Link>
          <Link to="/settings">Settings</Link>
          <Link to="/diagnostics">Diagnostics</Link>
        </div>
      </footer>
    </div>
  )
}
