import { getSavedAudience, getSavedPapers } from "@/features/papers/application"
import { HydrationBoundary } from "@/lib/atom-hydration"
import { dehydrate } from "@/lib/atom-utils"
import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { AsyncResult } from "effect/reactivity"
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
 * Head entries for the saved page.
 * @returns The saved title and preview copy.
 */
export const savedHead = () =>
  pageHead({
    title: "Saved · AcademiTok",
    description:
      "The papers you saved from the AcademiTok reading deck, exportable as BibTeX.",
    noindex: true,
  })

export const Route = createFileRoute("/saved")({
  head: savedHead,
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
