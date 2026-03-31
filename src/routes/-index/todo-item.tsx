import type { Todo } from "@/api/todo-schema"
import { Button } from "@/design-system/components/Button"
import { Card } from "@/design-system/components/Card"
import { Checkbox } from "@/design-system/components/Checkbox"
import { Heading } from "@/design-system/components/Heading"
import { Text } from "@/design-system/components/Text"
import { TextField } from "@/design-system/components/TextField"
import { Expand } from "@/design-system/primitives/Expand"
import { Inline } from "@/design-system/primitives/Inline"
import { Stack } from "@/design-system/primitives/Stack"
import { useAtom, useAtomRefresh } from "@effect/atom-react"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import { useState } from "react"
import { deleteTodoAtom, todosAtom, updateTodoAtom } from "./atoms"

/**
 * Renders a single todo item, allowing for toggling completion, editing, and deletion.
 *
 * @param props - The properties for the TodoItem component.
 * @param props.todo - The todo object to display.
 * @returns The rendered todo item.
 */
export function TodoItem({ todo }: { readonly todo: Todo }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(todo.title)
  const [updateResult, update] = useAtom(updateTodoAtom)
  const [deleteResult, deleteTodo] = useAtom(deleteTodoAtom)
  const refreshTodos = useAtomRefresh(todosAtom)

  const handleToggle = () => {
    update({
      id: todo.id,
      input: { title: Option.none(), completed: Option.some(!todo.completed) },
    })
  }

  const handleDelete = () => {
    deleteTodo(todo.id)
  }

  const handleSaveEdit = () => {
    if (!editTitle.trim()) {
      return
    }
    update({
      id: todo.id,
      input: {
        title: Option.some(editTitle.trim()),
        completed: Option.none(),
      },
    })
    setIsEditing(false)
  }

  const isLoading = updateResult.waiting || deleteResult.waiting
  const hasError = AsyncResult.isFailure(updateResult)
    || AsyncResult.isFailure(deleteResult)

  return (
    <Card tone={hasError ? "danger" : "default"}>
      <Stack gap="m">
        <Inline align="between" wrap>
          <Expand>
            <Checkbox
              checked={todo.completed}
              disabled={isLoading}
              onChange={handleToggle}
              label={
                <Heading as="h4" tone="card">
                  {todo.title}
                </Heading>
              }
            />
          </Expand>
          <Inline gap="xs" wrap>
            <Button
              variant="ghost"
              onClick={() => setIsEditing(true)}
              disabled={isLoading}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={isLoading}
              loading={deleteResult.waiting}
            >
              Delete
            </Button>
          </Inline>
        </Inline>
        {isEditing && (
          <Inline gap="s" align="start" wrap>
            <TextField
              label="Edit title"
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
            />
            <Inline gap="xs">
              <Button onClick={handleSaveEdit} loading={updateResult.waiting}>
                Save
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsEditing(false)
                  setEditTitle(todo.title)
                }}
              >
                Cancel
              </Button>
            </Inline>
          </Inline>
        )}
        {hasError && (
          <Inline gap="xs" wrap>
            <Text tone="danger">
              Operation failed.
            </Text>
            <Button variant="secondary" onClick={refreshTodos}>
              Refresh
            </Button>
          </Inline>
        )}
      </Stack>
    </Card>
  )
}
