import type { ReactNode } from "react"

type AsideStackProps = {
  readonly children: ReactNode
}

/**
 * Vertical stack for sidebar content.
 *
 * @param props - Stack props.
 * @param props.children - Sidebar sections.
 * @returns A sidebar stack.
 */
export function AsideStack({ children }: AsideStackProps) {
  return (
    <div className="flex flex-col gap-l">
      {children}
    </div>
  )
}
