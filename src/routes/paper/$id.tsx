import type { Paper } from "@/api/paper-schema"
import { EmptyState } from "@/design-system/components/EmptyState"
import { LinkButton } from "@/design-system/components/LinkButton"
import { Page } from "@/design-system/components/Page"
import { PaperPage } from "@/design-system/components/PaperPage"
import {
  getPaperAudience,
  getPaperById,
  getPaperHiddenBy,
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

const getPermalinkHiddenBy = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    Schema.decodeUnknownSync(paperPermalinkInput)(input)
  )
  .handler(({ data }) => serverRuntime.runPromise(getPaperHiddenBy(data.id)))

/**
 * Download URL for one clipping's BibTeX entry (SPEC §14).
 * @param id - Paper id, percent-encoded so DOIs keep neither space nor slash.
 * @returns The `paper.bib` route URL.
 */
export const paperBibtexHref = (id: string) =>
  `/api/paper.bib?id=${encodeURIComponent(id)}`

/**
 * Head entries for a clipping permalink: the paper title and abstract preview,
 * Open Graph article metadata, a canonical link, and JSON-LD ScholarlyArticle
 * structured data for search engines and chat clients.
 * @param paper - Loaded paper, absent when the id is unknown.
 * @returns The full SEO head for one clipping.
 */
export const permalinkHead = (paper: Paper | undefined) => {
  if (paper === undefined) {
    return pageHead({
      title: "Clipping not found · AcademiTok",
      description:
        "This permalink points at a paper the edition has not printed.",
      noindex: true,
    })
  }

  const permalink = `https://academitok.com/paper/${
    encodeURIComponent(paper.id)
  }`
  const headline = `${paper.title} · AcademiTok`

  return {
    meta: [
      { title: headline },
      { name: "description", content: paper.abstract },
      { property: "og:type", content: "article" },
      { property: "og:title", content: paper.title },
      { property: "og:description", content: paper.abstract },
      { property: "og:url", content: permalink },
      { property: "og:site_name", content: "AcademiTok" },
      {
        property: "og:image",
        content: "https://academitok.com/apple-touch-icon.png",
      },
      {
        property: "article:published_time",
        content: `${paper.year}-01-01`,
      },
      ...paper.authors.map((author) => ({
        property: "article:author",
        content: author,
      })),
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: paper.title },
      { name: "twitter:description", content: paper.abstract },
    ],
    links: [
      { rel: "canonical", href: permalink },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ScholarlyArticle",
          headline: paper.title,
          abstract: paper.abstract,
          author: paper.authors.map((name) => ({ "@type": "Person", name })),
          datePublished: `${paper.year}`,
          inLanguage: "en",
          url: permalink,
          mainEntityOfPage: permalink,
          identifier: paper.id,
          ...(paper.externalUrl === undefined
            ? {}
            : { sameAs: paper.externalUrl }),
          isAccessibleForFree: paper.access === "open",
          publisher: {
            "@type": "Organization",
            name: paper.venue,
          },
        }),
      },
    ],
  }
}

export const Route = createFileRoute("/paper/$id")({
  loader: async ({ params }) => {
    const [
      paper,
      savedByReaders,
      openedByReaders,
      likedByReaders,
      hiddenByReaders,
    ] = await Promise.all([
      getPaperPermalink({ data: { id: params.id } }),
      getPermalinkAudience({ data: { id: params.id } }),
      getPermalinkOpenedBy({ data: { id: params.id } }),
      getPermalinkLikedBy({ data: { id: params.id } }),
      getPermalinkHiddenBy({ data: { id: params.id } }),
    ])
    if (paper === null) {
      throw notFound()
    }

    return {
      hiddenByReaders,
      likedByReaders,
      openedByReaders,
      paper,
      savedByReaders,
    }
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
  const {
    hiddenByReaders,
    likedByReaders,
    paper,
    openedByReaders,
    savedByReaders,
  } = Route.useLoaderData()

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
        hiddenByReaders={hiddenByReaders}
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
