import { EmptyState } from "@/design-system/components/EmptyState"
import { LinkButton } from "@/design-system/components/LinkButton"
import { Page } from "@/design-system/components/Page"
import { PaperPage } from "@/design-system/components/PaperPage"
import { getPaperById } from "@/features/papers/application"
import { formatCitation } from "@/features/papers/citation"
import { createFileRoute, notFound } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import * as Schema from "effect/Schema"
import { serverRuntime } from "../api/$"

const paperPermalinkInput = Schema.Struct({ id: Schema.NonEmptyString })

const getPaperPermalink = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    Schema.decodeUnknownSync(paperPermalinkInput)(input)
  )
  .handler(({ data }) => serverRuntime.runPromise(getPaperById(data.id)))

export const Route = createFileRoute("/paper/$id")({
  loader: async ({ params }) => {
    const paper = await getPaperPermalink({ data: { id: params.id } })
    if (paper === null) {
      throw notFound()
    }

    return paper
  },
  head: ({ loaderData }) => ({
    meta: [{
      title: loaderData === undefined
        ? "Clipping not found · AcademiTok"
        : `${loaderData.title} · AcademiTok`,
    }],
  }),
  component: PaperPermalinkRoute,
  notFoundComponent: PaperNotFound,
})

/**
 * Renders one canonical clipping from its permalink.
 * @returns The permalink page.
 */
function PaperPermalinkRoute() {
  const paper = Route.useLoaderData()

  return (
    <Page>
      <PaperPage
        abstract={paper.abstract}
        accessLabel={paper.access === "open"
          ? "Open access"
          : "Institution access"}
        authors={paper.authors}
        citation={formatCitation(paper)}
        citations={paper.citations}
        externalUrl={paper.externalUrl}
        readMinutes={paper.readMinutes}
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
