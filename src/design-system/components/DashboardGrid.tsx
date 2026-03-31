import type { ReactNode } from "react"

type DashboardGridProps = {
  readonly children: ReactNode
}

/**
 * Two-column dashboard layout with responsive collapse.
 *
 * @param props - Grid props.
 * @param props.children - Primary and sidebar content.
 * @returns A responsive dashboard grid.
 */
export function DashboardGrid({ children }: DashboardGridProps) {
  return (
    <div className="grid gap-l grid-cols-1 min-[960px]:grid-cols-[minmax(0,1.8fr)_minmax(18rem,0.9fr)]">
      {children}
    </div>
  )
}
