import type { HTMLAttributes, ReactNode } from "react"

const toneClass = {
  body: "text-text-secondary text-[0.95rem] leading-[1.5]",
  muted: "text-text-muted text-[0.95rem] leading-[1.5]",
  label:
    "text-text-secondary text-[0.8rem] font-semibold tracking-[0.02em] uppercase",
  caption: "text-text-muted text-[0.85rem] leading-[1.4]",
  danger: "text-danger-solid text-[0.85rem] leading-[1.4]",
} as const

type TextProps =
  & Omit<
    HTMLAttributes<HTMLParagraphElement | HTMLSpanElement | HTMLDivElement>,
    "className"
  >
  & {
    readonly children: ReactNode
    readonly as?: "p" | "span" | "div" | undefined
    readonly tone?: keyof typeof toneClass | undefined
  }

/**
 * Renders semantic body typography.
 *
 * @param props - Text props.
 * @param props.as - Underlying HTML element.
 * @param props.children - Text content.
 * @param props.tone - Typography role.
 * @returns A semantic text element.
 */
export function Text(
  { as = "p", children, tone = "body", ...props }: TextProps,
) {
  const Component = as
  return (
    <Component {...props} className={toneClass[tone]}>
      {children}
    </Component>
  )
}
