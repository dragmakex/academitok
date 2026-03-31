import type { ReactNode } from "react"

type GroupHeaderProps = {
  readonly children: ReactNode
}

/**
 * Horizontal header row for a grouped section.
 *
 * @param props - Header props.
 * @param props.children - Title and badge content.
 * @returns A group header.
 */
export function GroupHeader({ children }: GroupHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-s mb-s">
      {children}
    </div>
  )
}
