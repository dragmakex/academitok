import type { ReactNode } from "react"

const toneClass = {
  default: "border-t-2 border-ink bg-paper",
  subtle: "border-t border-rule-soft bg-paper",
  accent: "border-2 border-ink bg-paper",
  danger: "border-t-2 border-ink bg-paper",
} as const

type SurfaceProps = {
  readonly children: ReactNode
  readonly tone?: keyof typeof toneClass | undefined
  readonly as?: "div" | "section" | undefined
}

/**
 * Semantic surface container for grouped content.
 *
 * Renders as `<section>` — the browser's element for thematically
 * grouped content with a heading.
 *
 * @param props - Surface props.
 * @param props.children - Surface content.
 * @param props.tone - Surface tone role.
 * @param props.as - Underlying semantic container.
 * @returns A semantic container with visual surface treatment.
 */
export function Surface(
  { as = "section", children, tone = "default" }: SurfaceProps,
) {
  const Component = as

  return (
    <Component className={toneClass[tone]}>
      {children}
    </Component>
  )
}
