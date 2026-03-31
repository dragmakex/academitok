import type { ReactNode } from "react"

type StatsGridProps = {
  readonly children: ReactNode
}

/**
 * Responsive grid for dashboard stat cards.
 *
 * @param props - Grid props.
 * @param props.children - StatCard elements.
 * @returns A responsive stats grid.
 */
export function StatsGrid({ children }: StatsGridProps) {
  return (
    <div className="grid gap-m grid-cols-[repeat(auto-fit,minmax(12rem,1fr))]">
      {children}
    </div>
  )
}
