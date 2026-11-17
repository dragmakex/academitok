import { getSavedPapers } from "@/features/papers/application"
import { HydrationBoundary } from "@/lib/atom-hydration"
import { dehydrate } from "@/lib/atom-utils"
import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import { savedPageAtom } from "./-index/atoms"
import { withRequestReader } from "./-lib/request-reader"
import { SavedPage } from "./-saved/saved"
import { serverRuntime } from "./api/$"

const getSavedClippings = createServerFn({ method: "GET" }).handler(
  async () => {
    const page = await serverRuntime.runPromise(
      withRequestReader(getSavedPapers),
    )
    return [
      dehydrate(savedPageAtom.remote, AsyncResult.success(page), Date.now()),
    ]
  },
)

export const Route = createFileRoute("/saved")({
  loader: () => getSavedClippings(),
  component: SavedRoute,
})

/**
 * Hydrates saved clippings from the server payload.
 * @returns Saved route with hydrated atoms.
 */
function SavedRoute() {
  const dehydrated = Route.useLoaderData()
  return (
    <HydrationBoundary state={dehydrated}>
      <SavedPage />
    </HydrationBoundary>
  )
}
