import type { ReactNode } from "react"

type PageShellProps = {
  readonly children: ReactNode
}

/**
 * Wraps full-page application surfaces.
 *
 * @param props - Shell props.
 * @param props.children - Page content.
 * @returns A page shell wrapper.
 */
export function PageShell({ children }: PageShellProps) {
  return (
    <div className="min-h-screen bg-bg-canvas">
      {children}
    </div>
  )
}
