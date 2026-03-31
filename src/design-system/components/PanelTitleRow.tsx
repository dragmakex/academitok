import type { ReactNode } from "react"

type PanelTitleRowProps = {
  readonly children: ReactNode
}

/**
 * Horizontal row for panel title and trailing action.
 *
 * @param props - Row props.
 * @param props.children - Title and action content.
 * @returns A panel title row.
 */
export function PanelTitleRow({ children }: PanelTitleRowProps) {
  return (
    <div className="flex items-center justify-between gap-s">
      {children}
    </div>
  )
}
