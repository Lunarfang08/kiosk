import { useMemo } from 'react'
import { avatarAssetUrl } from '@/services/avatarService'
import { useAvatarEngineVisuals } from '@/hooks/useAvatarEngine'
import { cn } from '@/lib/utils'

/** Mouth sits ~58% down on the generated receptionist portrait. */
const MOUTH_Y = 58
const JAW_ORIGIN_Y = 54

export function PortraitAvatar() {
  const { avatar, mouthOpen, attentive, thinking, speaking, idle, state } =
    useAvatarEngineVisuals()
  const src = avatarAssetUrl(avatar?.image_path) || '/default-avatar.svg'
  const scale = avatar?.avatar_scale ?? 1
  const intensity = avatar?.expression_intensity ?? 0.85

  const open = useMemo(() => {
    const v = Math.max(0, Math.min(1, mouthOpen))
    return v * intensity
  }, [mouthOpen, intensity])

  const jawScale = 1 + open * 0.14
  const headBob = open * 1.8
  const headTilt = (open - 0.35) * 0.6
  const mouthH = 3 + open * 22
  const mouthW = 9 + open * 7

  return (
    <div
      className="relative flex h-full w-full items-center justify-center"
      style={{ background: avatar?.background || 'transparent' }}
    >
      <div
        className={cn(
          'relative aspect-[3/4] h-[72vh] max-h-[820px] w-auto max-w-[75vw] transition-transform duration-500',
          attentive && !speaking && 'translate-y-[-0.5%]',
          thinking && 'scale-[0.995]',
        )}
        style={{
          transform: `scale(${scale}) translateY(${speaking ? -headBob : 0}px) rotate(${speaking ? headTilt : 0}deg)`,
          transition: speaking ? 'transform 60ms linear' : 'transform 400ms ease',
        }}
      >
        <div
          className={cn(
            'absolute inset-0 rounded-[2.5rem] opacity-70 blur-3xl transition-all duration-700',
            speaking
              ? 'bg-[radial-gradient(circle_at_center,rgba(61,214,198,0.35),transparent_65%)]'
              : thinking
                ? 'bg-[radial-gradient(circle_at_center,rgba(91,140,255,0.28),transparent_65%)]'
                : 'bg-[radial-gradient(circle_at_center,rgba(120,140,180,0.16),transparent_65%)]',
          )}
        />

        <div className="relative h-full w-full overflow-hidden rounded-[2.5rem] border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
          {/* Base portrait */}
          <img
            src={src}
            alt={avatar?.name || 'Digital human'}
            className={cn(
              'absolute inset-0 h-full w-full object-cover object-top transition duration-500',
              idle && 'animate-[breathe_4.5s_ease-in-out_infinite]',
              attentive && !speaking && 'brightness-[1.04]',
              thinking && 'saturate-[0.92] brightness-[0.96]',
            )}
            draggable={false}
          />

          {/* Lower-face jaw warp — same photo, clipped & stretched with audio */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              clipPath: `inset(${JAW_ORIGIN_Y}% 12% 18% 12%)`,
              transform: `scaleY(${jawScale})`,
              transformOrigin: `50% ${JAW_ORIGIN_Y}%`,
              willChange: 'transform',
            }}
            aria-hidden
          >
            <img
              src={src}
              alt=""
              className="h-full w-full object-cover object-top"
              draggable={false}
            />
          </div>

          {/* Mouth cavity — opens with speech energy */}
          <div
            className="pointer-events-none absolute left-1/2 -translate-x-1/2"
            style={{ top: `${MOUTH_Y}%` }}
            aria-hidden
          >
            <div
              className="mx-auto rounded-[50%] bg-[#2a1518] shadow-[inset_0_2px_4px_rgba(0,0,0,0.55)]"
              style={{
                height: `${mouthH}px`,
                width: `${mouthW}%`,
                minWidth: 18,
                opacity: open > 0.04 ? 0.55 + open * 0.4 : 0,
                transform: `translateY(${open * 2}px)`,
                transition: 'opacity 40ms linear',
              }}
            />
          </div>

          {thinking && (
            <div className="absolute inset-x-0 bottom-8 flex justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full bg-[var(--color-accent-2)] animate-pulse"
                  style={{ animationDelay: `${i * 160}ms` }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 text-center text-xs uppercase tracking-[0.22em] text-[var(--color-muted)]">
          {state.replaceAll('_', ' ')} · audio-driven portrait
        </div>
      </div>

      <style>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.012); }
        }
      `}</style>
    </div>
  )
}
