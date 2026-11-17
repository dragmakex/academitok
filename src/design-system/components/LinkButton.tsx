import { cx } from "@/design-system/foundation/classes"
import type { AnchorHTMLAttributes, ReactNode } from "react"

const baseClass =
  "inline-flex items-center justify-center gap-xs min-h-9 px-s border no-underline font-label text-[0.72rem] font-bold uppercase tracking-[0.14em] transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2"

const variantClass = {
  primary: "border-ink bg-ink text-paper hover:bg-paper hover:text-ink",
  secondary: "border-ink bg-paper text-ink hover:bg-ink hover:text-paper",
  ghost:
    "border-transparent bg-transparent px-0 text-ink underline underline-offset-4 hover:text-ink-muted",
} as const

type LinkButtonProps =
  & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className">
  & {
    readonly children: ReactNode
    readonly variant?: keyof typeof variantClass | undefined
  }

/**
 * Renders a link with button affordance.
 * @param root0 - Link props.
 * @param root0.children - Link content.
 * @param root0.target - Browsing context target.
 * @param root0.rel - Link relationship.
 * @param root0.variant - Visual variant.
 * @returns Styled anchor.
 */
export function LinkButton(
  {
    children,
    target = "_blank",
    rel = "noreferrer",
    variant = "primary",
    ...props
  }: LinkButtonProps,
) {
  return (
    <a
      {...props}
      target={target}
      rel={rel}
      className={cx(baseClass, variantClass[variant])}
    >
      {children}
    </a>
  )
}
