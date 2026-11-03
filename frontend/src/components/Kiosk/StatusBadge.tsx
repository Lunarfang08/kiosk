import { cn } from '@/lib/utils'
import type { ConversationState } from '@/stores/sessionStore'

const labels: Record<ConversationState, string> = {
  idle: 'Ready',
  initializing: 'Initializing',
  connecting_to_dograh: 'Connecting',
  listening: 'Listening',
  processing: 'Thinking',
  speaking: 'Speaking',
  interrupted: 'Interrupted',
  reconnecting: 'Reconnecting',
  error: 'Error',
}

export function StatusBadge({ state }: { state: ConversationState }) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.18em]',
        state === 'listening' && 'border-emerald-400/40 text-emerald-300',
        state === 'speaking' && 'border-cyan-400/40 text-cyan-300',
        state === 'processing' && 'border-sky-400/40 text-sky-300',
        state === 'error' && 'border-rose-400/40 text-rose-300',
        !['listening', 'speaking', 'processing', 'error'].includes(state) &&
          'border-white/15 text-[var(--color-muted)]',
      )}
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          state === 'listening' && 'bg-emerald-400 animate-pulse',
          state === 'speaking' && 'bg-cyan-400 animate-pulse',
          state === 'processing' && 'bg-sky-400 animate-pulse',
          state === 'error' && 'bg-rose-400',
          !['listening', 'speaking', 'processing', 'error'].includes(state) &&
            'bg-white/40',
        )}
      />
      {labels[state]}
    </div>
  )
}
