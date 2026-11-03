import { Maximize2, Mic, PhoneOff, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDograhSession } from '@/hooks/useDograhSession'
import { useSessionStore } from '@/stores/sessionStore'

export function KioskControls() {
  const state = useSessionStore((s) => s.state)
  const setFullscreen = useSessionStore((s) => s.setFullscreen)
  const { start, stop, interruptSpeaking } = useDograhSession()
  const live = !['idle', 'error'].includes(state)

  return (
    <div className="flex items-center gap-3">
      {!live ? (
        <Button size="lg" onClick={() => void start()}>
          <Mic className="h-5 w-5" />
          Start conversation
        </Button>
      ) : (
        <>
          <Button size="lg" variant="secondary" onClick={interruptSpeaking}>
            <Square className="h-4 w-4" />
            Interrupt
          </Button>
          <Button size="lg" variant="danger" onClick={() => void stop()}>
            <PhoneOff className="h-4 w-4" />
            End
          </Button>
        </>
      )}
      <Button
        size="icon"
        variant="ghost"
        aria-label="Fullscreen"
        onClick={() => {
          const el = document.documentElement
          if (!document.fullscreenElement) {
            void el.requestFullscreen()
            setFullscreen(true)
          } else {
            void document.exitFullscreen()
            setFullscreen(false)
          }
        }}
      >
        <Maximize2 className="h-5 w-5" />
      </Button>
    </div>
  )
}
