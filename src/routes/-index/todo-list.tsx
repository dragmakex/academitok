import { EmptyState } from "@/design-system/components/EmptyState"
import { ErrorState } from "@/design-system/components/ErrorState"
import { Text } from "@/design-system/components/Text"
import { TodoList as TodoListLayout } from "@/design-system/components/TodoLayout"
import { useAtomRefresh, useAtomValue } from "@effect/atom-react"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import { todosAtom } from "./atoms"
import { TodoItem } from "./todo-item"

/**
 * Renders a list of todo items, handling loading, empty states, and errors.
 *
 * @returns The rendered todo list.
 */
export function TodoList() {
  const result = useAtomValue(todosAtom)
  const refreshTodos = useAtomRefresh(todosAtom)

  return AsyncResult
    .builder(result)
    .onInitial(() => (
      <Text tone="muted">
        Loading todos…
      </Text>
    ))
    .onSuccess((todos) =>
      todos.length === 0
        ? (
          <EmptyState
            title="No todos yet"
            description="Add one above to get started!"
          />
        )
        : (
          <TodoListLayout>
            {todos.map((todo) => <TodoItem key={todo.id} todo={todo} />)}
          </TodoListLayout>
        )
    )
    .onFailure(() => (
      <ErrorState
        title="Something went wrong"
        description="Could not load todos."
        actionLabel="Retry"
        onAction={refreshTodos}
      />
    ))
    .render()
}
