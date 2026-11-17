import type { Paper } from "@/api/paper-schema"
import { EmptyState } from "@/design-system/components/EmptyState"
import { LinkButton } from "@/design-system/components/LinkButton"
import { Page } from "@/design-system/components/Page"
import { PaperPage } from "@/design-system/components/PaperPage"
import {
  getPaperAudience,
  getPaperById,
  getPaperLikedBy,
  getPaperOpenedBy,
} from "@/features/papers/application"
import { formatCitation } from "@/features/papers/citation"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import * as Schema from "effect/Schema"
import { pageHead } from "../__root"
import { serverRuntime } from "../api/$"

const paperPermalinkInput = Schema.Struct({ id: Schema.NonEmptyString })

const getPaperPermalink = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    Schema.decodeUnknownSync(paperPermalinkInput)(input)
  )
  .handler(({ data }) => serverRuntime.runPromise(getPaperById(data.id)))

const getPermalinkAudience = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    Schema.decodeUnknownSync(paperPermalinkInput)(input)
  )
  .handler(({ data }) => serverRuntime.runPromise(getPaperAudience(data.id)))

const getPermalinkOpenedBy = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    Schema.decodeUnknownSync(paperPermalinkInput)(input)
  )
  .handler(({ data }) => serverRuntime.runPromise(getPaperOpenedBy(data.id)))

const getPermalinkLikedBy = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    Schema.decodeUnknownSync(paperPermalinkInput)(input)
  )
  .handler(({ data }) => serverRuntime.runPromise(getPaperLikedBy(data.id)))

/**
 * Download URL for one clipping's BibTeX entry (SPEC §14).
 * @param id - Paper id, percent-encoded so DOIs keep neither space nor slash.
 * @returns The `paper.bib` route URL.
 */
export const paperBibtexHref = (id: string) =>
  `/api/paper.bib?id=${encodeURIComponent(id)}`

/**
 * Head entries for a clipping permalink.
 * @param paper - Loaded paper, absent when the id is unknown.
 * @returns The paper title and abstract preview, or the not-found notice.
 */
export const permalinkHead = (paper: Paper | undefined) =>
  paper === undefined
    ? pageHead({
      title: "Clipping not found · AcademiTok",
      description:
        "This permalink points at a paper the edition has not printed.",
    })
    : pageHead({
      title: `${paper.title} · AcademiTok`,
      description: paper.abstract,
    })

export const Route = createFileRoute("/paper/$id")({
  loader: async ({ params }) => {
    const [paper, savedByReaders, openedByReaders, likedByReaders] =
      await Promise.all([
        getPaperPermalink({ data: { id: params.id } }),
        getPermalinkAudience({ data: { id: params.id } }),
        getPermalinkOpenedBy({ data: { id: params.id } }),
        getPermalinkLikedBy({ data: { id: params.id } }),
      ])
    if (paper === null) {
      throw notFound()
    }

    return { likedByReaders, openedByReaders, paper, savedByReaders }
  },
  head: ({ loaderData }) =>
    permalinkHead(loaderData === undefined ? undefined : loaderData.paper),
  component: PaperPermalinkRoute,
  notFoundComponent: PaperNotFound,
})

/**
 * Renders one canonical clipping from its permalink.
 * @returns The permalink page.
 */
function PaperPermalinkRoute() {
  const { likedByReaders, paper, openedByReaders, savedByReaders } = Route
    .useLoaderData()

  return (
    <Page>
      <PaperPage
        abstract={paper.abstract}
        accessLabel={paper.access === "open"
          ? "Open access"
          : "Institution access"}
        authors={paper.authors}
        bibtexHref={paperBibtexHref(paper.id)}
        citation={formatCitation(paper)}
        citations={paper.citations}
        externalUrl={paper.externalUrl}
        likedByReaders={likedByReaders}
        openedByReaders={openedByReaders}
        readMinutes={paper.readMinutes}
        savedByReaders={savedByReaders}
        siteLabel={paper.site}
        title={paper.title}
        topics={paper.topics}
        venue={paper.venue}
        year={paper.year}
      />
    </Page>
  )
}

/**
 * Renders the broadsheet notice for an unknown permalink.
 * @returns The not-found notice.
 */
function PaperNotFound() {
  return (
    <Page>
      <EmptyState
        title="No such clipping in the archive"
        description="This permalink points at a paper the edition has not printed. Return to the front page to keep reading."
        action={
          <LinkButton href="/" target="_self" variant="secondary">
            Back to the edition
          </LinkButton>
        }
      />
    </Page>
  )
}
