import { getPaperFeedSnapshot } from "@/features/papers/application"
import { HydrationBoundary } from "@/lib/atom-hydration"
import { dehydrate } from "@/lib/atom-utils"
import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import { App } from "./-index/app"
import { dashboardSnapshotAtom } from "./-index/atoms"
import { serverRuntime } from "./api/$"

const getPaperFeed = createServerFn({ method: "GET" }).handler(async () => {
  const snapshot = await serverRuntime.runPromise(getPaperFeedSnapshot({
    query: { topic: "All", sort: "recommended" },
    cursor: null,
  }))
  const dehydratedAt = Date.now()

  return [
    dehydrate(
      dashboardSnapshotAtom.remote,
      AsyncResult.success(snapshot),
      dehydratedAt,
    ),
  ]
})

export const Route = createFileRoute("/")({
  loader: () => getPaperFeed(),
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
    <HydrationBoundary state={dehydrated}>
      <App />
    </HydrationBoundary>
  )
}
