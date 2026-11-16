import { cx } from "@/design-system/foundation/classes"
import type { AnchorHTMLAttributes, ReactNode } from "react"

const baseClass =
  "inline-flex items-center justify-center gap-xs min-h-11 px-m border border-transparent rounded-md text-[0.95rem] font-semibold transition-all duration-160 ease-in-out hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"

const variantClass = {
  primary: "bg-accent-solid text-white",
  secondary: "border-border-default bg-bg-surface text-text-primary",
  ghost: "bg-transparent text-text-secondary",
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
