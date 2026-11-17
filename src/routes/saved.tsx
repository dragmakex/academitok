import { getSavedAudience, getSavedPapers } from "@/features/papers/application"
import { HydrationBoundary } from "@/lib/atom-hydration"
import { dehydrate } from "@/lib/atom-utils"
import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import { savedPageAtom } from "./-index/atoms"
import { withRequestReader } from "./-lib/request-reader"
import { SavedPage } from "./-saved/saved"
import { pageHead } from "./__root"
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

const getSavedAudienceCount = createServerFn({ method: "GET" }).handler(
  async () => serverRuntime.runPromise(withRequestReader(getSavedAudience)),
)

/**
 * Head entries for the morgue.
 * @returns The morgue title and preview copy.
 */
export const morgueHead = () =>
  pageHead({
    title: "Clippings · AcademiTok",
    description:
      "The clippings you filed from the AcademiTok reading deck, kept as a broadsheet list you can export as BibTeX.",
  })

export const Route = createFileRoute("/saved")({
  head: morgueHead,
  loader: async () => {
    const [dehydrated, audience] = await Promise.all([
      getSavedClippings(),
      getSavedAudienceCount(),
    ])
    return { dehydrated, audience }
  },
  component: SavedRoute,
})

/**
 * Hydrates saved clippings from the server payload.
 * @returns Saved route with hydrated atoms.
 */
function SavedRoute() {
  const { audience, dehydrated } = Route.useLoaderData()
  return (
    <HydrationBoundary state={dehydrated}>
      <SavedPage audience={audience} />
    </HydrationBoundary>
  )
}
