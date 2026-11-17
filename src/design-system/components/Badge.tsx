import { cx } from "@/design-system/foundation/classes"
import type { ReactNode } from "react"

const badgeBaseClass =
  "inline-flex items-center justify-center px-2xs border border-ink font-label text-[0.62rem] font-bold uppercase tracking-[0.12em] text-ink"

const toneClass = {
  neutral: "bg-paper",
  accent: "bg-ink text-paper",
  success: "bg-paper",
  danger: "bg-paper",
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
    <span className={cx(badgeBaseClass, toneClass[tone])}>
      {children}
    </span>
  )
}
