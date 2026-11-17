import { cx } from "@/design-system/foundation/classes"
import type { HTMLAttributes, ReactNode } from "react"

const toneClass = {
  body: "text-ink font-body text-[1rem] leading-[1.45]",
  muted: "text-ink-muted font-body text-[0.95rem] leading-[1.45]",
  label:
    "text-ink font-label text-[0.7rem] font-bold tracking-[0.16em] uppercase",
  caption: "text-ink-muted font-body text-[0.85rem] italic leading-[1.35]",
  danger: "text-ink font-body text-[0.85rem] italic leading-[1.35]",
} as const

const alignClass = {
  start: "text-left",
  center: "text-center",
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
    readonly align?: keyof typeof alignClass | undefined
  }

/**
 * Renders semantic body typography.
 *
 * @param props - Text props.
 * @param props.as - Underlying HTML element.
 * @param props.children - Text content.
 * @param props.tone - Typography role.
 * @param props.align - Text alignment.
 * @returns A semantic text element.
 */
export function Text(
  { align = "start", as = "p", children, tone = "body", ...props }: TextProps,
) {
  const Component = as
  return (
    <Component
      {...props}
      className={cx(toneClass[tone], alignClass[align])}
    >
      {children}
    </Component>
  )
}
