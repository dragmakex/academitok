import { cx } from "@/design-system/foundation/classes"
import type { ButtonHTMLAttributes, ReactNode } from "react"

const baseClass =
  "inline-flex touch-manipulation items-center justify-center gap-xs min-h-9 px-s border font-label text-[0.72rem] font-bold uppercase tracking-[0.14em] cursor-pointer transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2"

const variantClass = {
  primary:
    "border-ink bg-ink text-paper hover:not-disabled:bg-paper hover:not-disabled:text-ink",
  secondary:
    "border-ink bg-paper text-ink hover:not-disabled:bg-ink hover:not-disabled:text-paper",
  ghost:
    "border-transparent bg-transparent px-0 text-ink underline underline-offset-4 hover:not-disabled:text-ink-muted",
  danger:
    "border-ink bg-paper text-ink hover:not-disabled:bg-ink hover:not-disabled:text-paper",
} as const

type ButtonProps =
  & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">
  & {
    readonly children: ReactNode
    readonly variant?: keyof typeof variantClass | undefined
    readonly loading?: boolean | undefined
  }

/**
 * Renders a semantic application button.
 *
 * @param props - Button props.
 * @param props.children - Button label content.
 * @param props.disabled - Whether the button is disabled.
 * @param props.loading - Whether to show the busy state.
 * @param props.type - Button type attribute.
 * @param props.variant - Semantic visual variant.
 * @returns A styled button element.
 */
export function Button(
  {
    children,
    disabled,
    loading = false,
    type = "button",
    variant = "primary",
    ...props
  }: ButtonProps,
) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      className={cx(baseClass, variantClass[variant])}
    >
      {loading ? "Working" : children}
    </button>
  )
}
