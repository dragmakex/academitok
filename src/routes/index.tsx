import { HydrationBoundary } from "@/lib/atom-hydration"
import { dehydrate } from "@/lib/atom-utils"
import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import * as Effect from "effect/Effect"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import { App } from "./-index/app"
import { todosAtom } from "./-index/atoms"
import { serverRuntime } from "./api/$"
import { TodosService } from "./api/-lib/todos-service"

const listTodos = createServerFn({ method: "GET" }).handler(async () => {
  const todos = await serverRuntime.runPromiseExit(
    Effect.flatMap(TodosService.asEffect(), (s) => s.list),
  )
  return dehydrate(todosAtom.remote, AsyncResult.fromExit(todos), Date.now())
})

export const Route = createFileRoute("/")({
  loader: () => listTodos(),
  component: AppWrapper,
})

/**
 * Wraps the main application component with a HydrationBoundary to provide dehydrated data.
 *
 * @returns The wrapped application component.
 */
function AppWrapper() {
  const dehydrated = Route.useLoaderData()
  return (
    <HydrationBoundary state={[dehydrated]}>
      <App />
    </HydrationBoundary>
  )
}
