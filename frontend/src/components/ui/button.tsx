import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:opacity-50 disabled:pointer-events-none touch-manipulation',
  {
    variants: {
      variant: {
        default: 'bg-[var(--color-accent)] text-[#04201c] hover:brightness-110',
        secondary: 'bg-[var(--color-panel-2)] text-ink border border-[var(--color-line)] hover:bg-[#1c2535]',
        ghost: 'bg-transparent text-ink hover:bg-white/5',
        danger: 'bg-[var(--color-danger)] text-white hover:brightness-110',
      },
      size: {
        default: 'h-11 px-5 text-sm',
        lg: 'h-14 px-7 text-base',
        icon: 'h-12 w-12',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
