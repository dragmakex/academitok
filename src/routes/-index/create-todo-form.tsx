import { Button } from "@/design-system/components/Button"
import { Card } from "@/design-system/components/Card"
import { Heading } from "@/design-system/components/Heading"
import { Text } from "@/design-system/components/Text"
import { TextField } from "@/design-system/components/TextField"
import { Inline } from "@/design-system/primitives/Inline"
import { Stack } from "@/design-system/primitives/Stack"
import { useAtom } from "@effect/atom-react"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import { useState } from "react"
import { createTodoAtom } from "./atoms"

/**
 * A form component for creating new todo items.
 *
 * @returns The rendered form.
 */
export function CreateTodoForm() {
  const [title, setTitle] = useState("")
  const [createResult, create] = useAtom(createTodoAtom)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      return
    }

    create({ title: title.trim() })
    setTitle("")
  }

  const hasError = AsyncResult.isFailure(createResult)

  return (
    <Card>
      <Stack gap="m">
        <Stack gap="2xs">
          <Heading as="h2" tone="section">
            Create todo
          </Heading>
          <Text tone="muted">
            Add a new task to your list.
          </Text>
        </Stack>
        <Inline gap="s" align="start" wrap>
          <TextField
            label="Task title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What needs to be done?"
            disabled={createResult.waiting}
          />
          <Button
            type="submit"
            onClick={handleSubmit}
            loading={createResult.waiting}
            disabled={!title.trim()}
          >
            Add
          </Button>
        </Inline>
        {hasError && (
          <Text tone="danger">
            Failed to create todo. Please try again.
          </Text>
        )}
      </Stack>
    </Card>
  )
}
