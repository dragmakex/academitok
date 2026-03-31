import type { ReactNode } from "react"

const toneClass = {
  default: "border border-border-default rounded-lg bg-bg-surface shadow-sm",
  subtle: "border border-border-default rounded-lg bg-bg-subtle shadow-sm",
  accent: "border border-accent-wash rounded-lg bg-bg-accent shadow-sm",
  danger: "border border-border-danger rounded-lg bg-bg-danger shadow-sm",
} as const

type SurfaceProps = {
  readonly children: ReactNode
  readonly tone?: keyof typeof toneClass | undefined
}

/**
 * Provides a semantic surface container for product UI sections.
 *
 * @param props - Surface props.
 * @param props.children - Surface content.
 * @param props.tone - Surface tone role.
 * @returns A styled semantic surface wrapper.
 */
export function Surface({ children, tone = "default" }: SurfaceProps) {
  return (
    <div className={toneClass[tone]}>
      {children}
    </div>
  )
}
