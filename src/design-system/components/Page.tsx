import type { ReactNode } from "react"

type PageProps = {
  readonly children: ReactNode
}

/**
 * Full-page application wrapper with centered, constrained content.
 *
 * @param props - Page props.
 * @param props.children - Page content.
 * @returns A page wrapper with content constraints.
 */
export function Page({ children }: PageProps) {
  return (
    <div className="min-h-screen bg-bg-canvas">
      <div className="mx-auto max-w-[80rem] px-l py-2xl">
        {children}
      </div>
    </div>
  )
}
