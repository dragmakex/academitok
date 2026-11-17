import type { HTMLAttributes, ReactNode } from "react"

const toneClass = {
  page:
    "m-0 text-ink font-display text-[clamp(2rem,4vw,3rem)] font-bold leading-[1.02] tracking-[-0.02em]",
  display:
    "m-0 text-ink font-display text-[clamp(1.5rem,2.6vw,2rem)] font-bold leading-[1.05] tracking-[-0.01em]",
  section: "m-0 text-ink font-display text-[1.0625rem] font-bold leading-[1.2]",
  card: "m-0 text-ink font-display text-[1rem] font-bold leading-[1.2]",
} as const

type HeadingProps =
  & Omit<HTMLAttributes<HTMLHeadingElement>, "className">
  & {
    readonly children: ReactNode
    readonly as?: "h1" | "h2" | "h3" | "h4" | undefined
    readonly tone?: keyof typeof toneClass | undefined
  }

/**
 * Renders semantic heading typography.
 *
 * @param props - Heading props.
 * @param props.as - Underlying heading element.
 * @param props.children - Heading content.
 * @param props.tone - Heading role.
 * @returns A semantic heading element.
 */
export function Heading(
  { as = "h2", children, tone = "section", ...props }: HeadingProps,
) {
  const Component = as
  return (
    <Component {...props} className={toneClass[tone]}>
      {children}
    </Component>
  )
}
