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
    <main className="min-h-screen bg-paper">
      {fullBleed
        ? children
        : (
          <div className="mx-auto max-w-[66rem] px-m py-xl sm:px-l">
            {children}
          </div>
        )}
    </main>
  )
}
