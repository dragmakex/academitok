import { Footer } from "@/component/Footer"
import { PageContent } from "@/design-system/components/PageContent"
import { PageHeader } from "@/design-system/components/PageHeader"
import { PageShell } from "@/design-system/components/PageShell"
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
    <PageShell>
      <PageContent>
        <Stack gap="xl">
          <PageHeader
            title="Todo App"
            description="A simple todo application built with Effect and TanStack."
          />
          <CreateTodoForm />
          <TodoList />
        </Stack>
      </PageContent>
      <Footer />
    </PageShell>
  )
}
