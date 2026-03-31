import type { ReactNode } from "react"

type PageContentProps = {
  readonly children: ReactNode
}

/**
 * Centers and constrains page content.
 *
 * @param props - Content props.
 * @param props.children - Page content.
 * @returns A content container.
 */
export function PageContent({ children }: PageContentProps) {
  return (
    <div className="mx-auto max-w-[80rem] px-l py-2xl">
      {children}
    </div>
  )
}
