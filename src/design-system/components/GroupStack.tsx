import type { ReactNode } from "react"

type GroupStackProps = {
  readonly children: ReactNode
}

/**
 * Vertical stack for grouped content sections.
 *
 * @param props - Stack props.
 * @param props.children - Group sections.
 * @returns A vertical group stack.
 */
export function GroupStack({ children }: GroupStackProps) {
  return (
    <div className="flex flex-col gap-l">
      {children}
    </div>
  )
}
