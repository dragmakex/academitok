import type { ReactNode } from "react"

type TodoListProps = {
  readonly children: ReactNode
}

/**
 * Vertical list container for todo items.
 *
 * @param props - List props.
 * @param props.children - TodoItem elements.
 * @returns A todo list container.
 */
export function TodoList({ children }: TodoListProps) {
  return (
    <div className="flex flex-col gap-s">
      {children}
    </div>
  )
}

type TodoCardProps = {
  readonly children: ReactNode
}

/**
 * Content layout within a single todo card.
 *
 * @param props - Card props.
 * @param props.children - Todo card content.
 * @returns A todo card layout.
 */
export function TodoCard({ children }: TodoCardProps) {
  return (
    <div className="flex flex-col gap-m">
      {children}
    </div>
  )
}

type TodoRowProps = {
  readonly children: ReactNode
}

/**
 * Horizontal row for todo main content and actions.
 *
 * @param props - Row props.
 * @param props.children - Main and action content.
 * @returns A todo row layout.
 */
export function TodoRow({ children }: TodoRowProps) {
  return (
    <div className="flex items-start gap-m justify-between">
      {children}
    </div>
  )
}

type TodoMainProps = {
  readonly children: ReactNode
}

/**
 * Flexible container for the primary todo content.
 *
 * @param props - Main props.
 * @param props.children - Checkbox and text content.
 * @returns A todo main area.
 */
export function TodoMain({ children }: TodoMainProps) {
  return (
    <div className="flex gap-m flex-1 min-w-0">
      {children}
    </div>
  )
}

type TodoActionsProps = {
  readonly children: ReactNode
}

/**
 * Action button group for a todo item.
 *
 * @param props - Actions props.
 * @param props.children - Action buttons and badges.
 * @returns A todo actions area.
 */
export function TodoActions({ children }: TodoActionsProps) {
  return (
    <div className="flex items-center flex-wrap gap-xs">
      {children}
    </div>
  )
}

type TodoMetaProps = {
  readonly children: ReactNode
}

/**
 * Inline metadata badges for a todo item.
 *
 * @param props - Meta props.
 * @param props.children - Badge elements.
 * @returns A todo meta area.
 */
export function TodoMeta({ children }: TodoMetaProps) {
  return (
    <div className="flex flex-wrap gap-xs">
      {children}
    </div>
  )
}
