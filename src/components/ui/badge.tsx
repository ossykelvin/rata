import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-none',
  {
    variants: {
      variant: {
        blue: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
        green: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
        amber: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
        red: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200',
        slate: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
        purple: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200'
      }
    },
    defaultVariants: { variant: 'slate' }
  }
)

interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
