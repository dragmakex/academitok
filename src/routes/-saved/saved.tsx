import type { Topic, TopicFilter } from "@/api/paper-schema"
import { Card } from "@/design-system/components/Card"
import { EmptyState } from "@/design-system/components/EmptyState"
import { ErrorState } from "@/design-system/components/ErrorState"
import { LinkButton } from "@/design-system/components/LinkButton"
import { Page } from "@/design-system/components/Page"
import { PageHeader } from "@/design-system/components/PageHeader"
import { PaperSlide } from "@/design-system/components/PaperSlide"
import { Tabs } from "@/design-system/components/Tabs"
import { Text } from "@/design-system/components/Text"
import { Stack } from "@/design-system/primitives/Stack"
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react"
import { useState } from "react"
import { removeSavedPaperAtom, savedPageAtom } from "../-index/atoms"

/**
 * Renders the saved clippings list as a static broadsheet page.
 * @param props - Loader data for the page.
 * @param props.audience - Other readers' filing counts per paper id.
 * @returns Saved clippings route content.
 */
export function SavedPage(
  { audience = {} }: { readonly audience?: Record<string, number> },
) {
  const pageAsync = useAtomValue(savedPageAtom)
  const removeSaved = useAtomSet(removeSavedPaperAtom)
  const refresh = useAtomRefresh(savedPageAtom)
  const [topic, setTopic] = useState<TopicFilter>("All")
  const page = pageAsync._tag === "Success" ? pageAsync.value : undefined
  const beatCounts = new Map<Topic, number>()

  for (const item of page?.items ?? []) {
    for (const beat of item.paper.topics) {
      beatCounts.set(beat, (beatCounts.get(beat) ?? 0) + 1)
    }
  }

  const tabs: ReadonlyArray<{
    readonly key: TopicFilter
    readonly label: string
    readonly count: number
  }> = [
    { key: "All", label: "All", count: page?.items.length ?? 0 },
    ...[...beatCounts].map(([beat, count]) => ({
      key: beat,
      label: beat,
      count,
    })),
  ]
  const items = topic === "All"
    ? page?.items ?? []
    : (page?.items ?? []).filter((item) =>
      item.paper.topics.some((beat) => beat === topic)
    )

  return (
    <Page>
      <Stack gap="l">
        <PageHeader
          title="Saved clippings"
          description="The morgue file: every paper you pinned while reading the edition."
          actions={
            <>
              {page !== undefined && page.items.length > 0
                ? (
                  <LinkButton
                    href="/api/saved.bib"
                    target="_self"
                    variant="primary"
                    download="academitok-saved.bib"
                  >
                    Export BibTeX
                  </LinkButton>
                )
                : null}
              <LinkButton href="/" variant="secondary">
                Back to the edition
              </LinkButton>
            </>
          }
        />

        {pageAsync._tag === "Failure"
          ? (
            <ErrorState
              title="The morgue file is locked"
              description="Saved clippings could not be read. Try again."
              actionLabel="Reload clippings"
              onAction={refresh}
            />
          )
          : page === undefined
          ? (
            <Card>
              <Text tone="muted">
                Reading the morgue file…
              </Text>
            </Card>
          )
          : page.items.length === 0
          ? (
            <EmptyState
              title="No clippings saved yet"
              description="Press Save in the rail of any paper and it is filed on this page."
            />
          )
          : (
            <>
              <Tabs
                id="saved-beat-tabs"
                activeTab={topic}
                items={tabs}
                onChange={setTopic}
              />
              {items.length === 0
                ? (
                  <EmptyState
                    title="This beat holds no clippings"
                    description="Choose All to read every saved paper."
                  />
                )
                : (
                  <Stack gap="xs">
                    {items.map((item) => (
                      <PaperSlide
                        key={item.paper.id}
                        variant="compact"
                        id={item.paper.id}
                        title={item.paper.title}
                        authors={item.paper.authors.join(", ")}
                        venue={item.paper.venue}
                        year={item.paper.year}
                        abstract={item.paper.summary}
                        accessLabel={item.paper.access === "open"
                          ? "Open access"
                          : item.accessible
                          ? "Institution access"
                          : "Source access"}
                        siteLabel={item.paper.site}
                        citations={item.paper.citations}
                        readMinutes={item.paper.readMinutes}
                        topics={item.paper.topics}
                        externalUrl={item.paper.externalUrl}
                        filedByOthers={audience[item.paper.id] ?? 0}
                        onUnsave={() => removeSaved(item.paper.id)}
                      />
                    ))}
                  </Stack>
                )}
            </>
          )}
      </Stack>
    </Page>
  )
}
