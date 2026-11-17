import { EditionIds } from "@/api/paper-schema"
import { getPaperFeedSnapshot } from "@/features/papers/application"
import { HydrationBoundary } from "@/lib/atom-hydration"
import { dehydrate } from "@/lib/atom-utils"
import { createFileRoute } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import * as Schema from "effect/Schema"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import { App } from "./-index/app"
import { dashboardSnapshotAtom } from "./-index/atoms"
import { withRequestReader } from "./-lib/request-reader"
import { pageHead } from "./__root"
import { serverRuntime } from "./api/$"

const editionInput = Schema.Struct({
  edition: Schema.optional(EditionIds),
})

/**
 * Reads the raw `edition` search param.
 * @param search - Raw search params.
 * @returns The param when it is a string, otherwise nothing.
 */
function validateEditionSearch(search: Record<string, unknown>) {
  return typeof search.edition === "string" ? { edition: search.edition } : {}
}

/**
 * Splits and validates the comma-separated edition param.
 * @param raw - Search param value.
 * @returns Paper ids, or `undefined` when the page was not shared.
 */
function parseEdition(raw: string | undefined): EditionIds | undefined {
  if (raw === undefined) {
    return undefined
  }
  const ids = Schema.decodeUnknownOption(EditionIds)(raw.split(","))
  return ids._tag === "Some" ? ids.value : undefined
}

const getPaperFeed = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    Schema.decodeUnknownSync(editionInput)(input)
  )
  .handler(async ({ data }) => {
    const snapshot = await serverRuntime.runPromise(
      withRequestReader(
        getPaperFeedSnapshot({
          query: { topic: "All", sort: "recommended" },
          cursor: null,
          edition: data.edition,
        }),
      ),
    )
    const dehydratedAt = Date.now()

    return [
      dehydrate(
        dashboardSnapshotAtom.remote,
        AsyncResult.success(snapshot),
        dehydratedAt,
      ),
    ]
  })

/**
 * Head entries for the reading deck.
 * @returns The deck title and preview copy.
 */
export const deckHead = () =>
  pageHead({
    title: "AcademiTok — the reading deck",
    description:
      "A full-screen reading deck of open-access papers, set like a broadsheet and tuned by what you read.",
  })

export const Route = createFileRoute("/")({
  head: deckHead,
  validateSearch: validateEditionSearch,
  loaderDeps: ({ search }) => ({ edition: parseEdition(search.edition) }),
  loader: ({ deps }) => getPaperFeed({ data: deps }),
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
