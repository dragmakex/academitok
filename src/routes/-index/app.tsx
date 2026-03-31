import { Footer } from "@/component/Footer"
import { Page } from "@/design-system/components/Page"
import { PageHeader } from "@/design-system/components/PageHeader"
import { Stack } from "@/design-system/primitives/Stack"
import { CreateTodoForm } from "./create-todo-form"
import { TodoList } from "./todo-list"

/**
 * The main application component.
 *
 * @returns The rendered application.
 */
export function App() {
  return (
    <Page>
      <Stack gap="xl">
        <PageHeader
          title="Todo App"
          description="A simple todo application built with Effect and TanStack."
        />
        <CreateTodoForm />
        <TodoList />
      </Stack>
      <Footer />
    </Page>
  )
}
