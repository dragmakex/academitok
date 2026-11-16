import type { ReactNode } from "react"

type PageProps = {
  readonly children: ReactNode
  readonly fullBleed?: boolean | undefined
}

/**
 * Full-page application wrapper with centered, constrained content.
 *
 * Renders as `<main>` — the browser's primary content landmark.
 *
 * @param props - Page props.
 * @param props.children - Page content.
 * @param props.fullBleed - Whether content should fill the viewport.
 * @returns A semantic page wrapper.
 */
export function Page({ children, fullBleed = false }: PageProps) {
  return (
    <main className="min-h-screen bg-bg-canvas">
      {fullBleed
        ? children
        : (
          <div className="mx-auto max-w-[80rem] px-l py-2xl">
            {children}
          </div>
        )}
    </main>
  )
}
