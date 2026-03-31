import type { ReactNode } from "react"

const toneClass = {
  neutral:
    "inline-flex items-center justify-center min-w-7 min-h-6 px-xs rounded-full text-[0.8rem] font-bold bg-bg-subtle text-text-secondary",
  accent:
    "inline-flex items-center justify-center min-w-7 min-h-6 px-xs rounded-full text-[0.8rem] font-bold bg-accent-wash text-text-on-accent",
  success:
    "inline-flex items-center justify-center min-w-7 min-h-6 px-xs rounded-full text-[0.8rem] font-bold bg-success-wash text-success-solid",
  danger:
    "inline-flex items-center justify-center min-w-7 min-h-6 px-xs rounded-full text-[0.8rem] font-bold bg-danger-wash text-danger-solid",
} as const

type BadgeProps = {
  readonly children: ReactNode
  readonly tone?: keyof typeof toneClass | undefined
}

/**
 * Renders a compact semantic badge.
 *
 * @param props - Badge props.
 * @param props.children - Badge content.
 * @param props.tone - Badge tone role.
 * @returns A badge element.
 */
export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span className={toneClass[tone]}>
      {children}
    </span>
  )
}
