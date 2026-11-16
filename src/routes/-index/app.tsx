import {
  type FeedItem,
  type FeedQuery,
  type Topic,
  type TopicFilter,
} from "@/api/paper-schema"
import { Button } from "@/design-system/components/Button"
import { Card } from "@/design-system/components/Card"
import { Checkbox } from "@/design-system/components/Checkbox"
import { EdgeDrawer } from "@/design-system/components/EdgeDrawer"
import { EmptyState } from "@/design-system/components/EmptyState"
import { ErrorState } from "@/design-system/components/ErrorState"
import { FeedDeck } from "@/design-system/components/FeedDeck"
import { FeedStateSlide } from "@/design-system/components/FeedStateSlide"
import { Page } from "@/design-system/components/Page"
import { PaperSlide } from "@/design-system/components/PaperSlide"
import { Tabs } from "@/design-system/components/Tabs"
import { Text } from "@/design-system/components/Text"
import { TextField } from "@/design-system/components/TextField"
import { Grid } from "@/design-system/primitives/Grid"
import { Stack } from "@/design-system/primitives/Stack"
import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  dashboardSnapshotAtom,
  loadNextPaperPageAtom,
  loadPaperFeedAtom,
  reactToPaperAtom,
  saveReaderProfileAtom,
  trackPaperViewAtom,
} from "./atoms"

const topics: ReadonlyArray<TopicFilter> = [
  "All",
  "AI",
  "Biology",
  "Climate",
  "Education",
  "Economics",
  "Health",
  "Physics",
  "Psychology",
  "Robotics",
]
const sorts: ReadonlyArray<FeedQuery["sort"]> = [
  "recommended",
  "latest",
  "citations",
]
const institutions = [
  "Guest",
  "MIT",
  "Oxford",
  "Stanford",
  "Max Planck",
] as const

type VisiblePaperSlideProps = {
  readonly active: boolean
  readonly index: number
  readonly item: FeedItem
  readonly total: number
  readonly onNavigate: (index: number) => void
  readonly onVisible: (index: number) => void
  readonly registerNode: (index: number, node: HTMLElement | null) => void
}

/**
 * Tracks visibility and binds one clipping.
 * @param root0 - Slide props.
 * @param root0.active - Whether full content is mounted.
 * @param root0.index - Feed index.
 * @param root0.item - Feed item.
 * @param root0.total - Mounted feed length.
 * @param root0.onNavigate - Navigation callback.
 * @param root0.onVisible - Visibility callback.
 * @param root0.registerNode - Slide registration callback.
 * @returns Tracked paper slide.
 */
function VisiblePaperSlide({
  active,
  index,
  item,
  onNavigate,
  onVisible,
  registerNode,
  total,
}: VisiblePaperSlideProps) {
  const nodeRef = useRef<HTMLElement | null>(null)
  const trackView = useAtomSet(trackPaperViewAtom)
  const reactToPaper = useAtomSet(reactToPaperAtom)
  const armed = useRef(false)
  const dwellSent = useRef(false)
  const visibleAt = useRef<number | null>(null)
  const armTimer = useRef<number | null>(null)

  useEffect(() => {
    const node = nodeRef.current
    if (node === null) {
      return
    }

    const clearArmTimer = () => {
      if (armTimer.current !== null) {
        window.clearTimeout(armTimer.current)
        armTimer.current = null
      }
    }
    const sendDwell = () => {
      if (!armed.current || dwellSent.current || visibleAt.current === null) {
        return
      }
      dwellSent.current = true
      trackView({
        paperId: item.paper.id,
        kind: "dwell",
        dwellMs: Math.max(0, performance.now() - visibleAt.current),
        position: index,
        exploration: item.exploration,
      })
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting !== true) {
          clearArmTimer()
          sendDwell()
          visibleAt.current = null
          return
        }

        onVisible(index)
        if (armed.current || armTimer.current !== null) {
          return
        }
        visibleAt.current = performance.now()
        armTimer.current = window.setTimeout(() => {
          armed.current = true
          armTimer.current = null
          trackView({
            paperId: item.paper.id,
            kind: "view",
            dwellMs: 0,
            position: index,
            exploration: item.exploration,
          })
        }, 400)
      },
      { threshold: 0.6 },
    )

    observer.observe(node)
    return () => {
      clearArmTimer()
      sendDwell()
      observer.disconnect()
    }
  }, [index, item.exploration, item.paper.id, onVisible, trackView])

  const react = (kind: "like" | "bookmark" | "hide" | "open-site") => {
    reactToPaper({ kind, paperId: item.paper.id })
  }

  return (
    <PaperSlide
      ref={(node) => {
        nodeRef.current = node
        registerNode(index, node)
      }}
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
      rationale={item.rationale}
      topics={item.paper.topics}
      liked={item.liked}
      bookmarked={item.bookmarked}
      externalUrl={item.paper.externalUrl}
      position={index + 1}
      total={total}
      skeleton={!active}
      actions={{
        onLike: () => react("like"),
        onBookmark: () => react("bookmark"),
        onHide: () => {
          onNavigate(index + 1)
          react("hide")
        },
        onOpenSite: () => react("open-site"),
        onPrevious: () => onNavigate(index - 1),
        onNext: () => onNavigate(index + 1),
      }}
    />
  )
}

/**
 * Renders the AcademiTok feed and reading desk.
 * @returns Full-screen feed application.
 */
export function App() {
  const snapshotAsync = useAtomValue(dashboardSnapshotAtom)
  const loadPaperFeed = useAtomSet(loadPaperFeedAtom)
  const loadNextPage = useAtomSet(loadNextPaperPageAtom)
  const saveProfile = useAtomSet(saveReaderProfileAtom)
  const snapshot = snapshotAsync._tag === "Success"
    ? snapshotAsync.value
    : undefined

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [query, setQuery] = useState<FeedQuery>({
    topic: snapshot?.selectedTopic ?? "All",
    sort: snapshot?.selectedSort ?? "recommended",
  })
  const [name, setName] = useState(snapshot?.profile?.name ?? "Guest Reader")
  const [institution, setInstitution] = useState(
    snapshot?.profile?.institution ?? "Guest",
  )
  const [selectedTopics, setSelectedTopics] = useState<ReadonlyArray<Topic>>(
    snapshot?.profile?.interests ?? ["AI", "Education", "Health"],
  )
  const deckRef = useRef<HTMLElement | null>(null)
  const slideNodes = useRef(new Map<number, HTMLElement>())
  const requestedCursors = useRef(new Set<string>())

  const registerNode = useCallback(
    (index: number, node: HTMLElement | null) => {
      if (node === null) {
        slideNodes.current.delete(index)
      } else {
        slideNodes.current.set(index, node)
      }
    },
    [],
  )

  const navigate = useCallback((index: number) => {
    const items = snapshot?.items ?? []
    if (items.length === 0) {
      return
    }
    const nextIndex = Math.max(0, Math.min(items.length - 1, index))
    slideNodes.current.get(nextIndex)?.scrollIntoView({ block: "start" })
  }, [snapshot?.items])

  const onVisible = useCallback((index: number) => {
    setActiveIndex(index)
    const cursor = snapshot?.nextCursor
    if (
      cursor !== null
      && cursor !== undefined
      && (snapshot?.items.length ?? 0) - index <= 4
      && !requestedCursors.current.has(cursor)
    ) {
      requestedCursors.current.add(cursor)
      loadNextPage({ query, cursor })
    }
  }, [loadNextPage, query, snapshot?.items.length, snapshot?.nextCursor])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const interactive = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || target instanceof HTMLButtonElement
        || target instanceof HTMLAnchorElement
      if (
        interactive || drawerOpen || event
          .metaKey || event
          .ctrlKey || event
          .altKey
      ) {
        return
      }

      const next = event.key === "ArrowDown"
        || event.key === "j"
        || event.key === " "
      const previous = event.key === "ArrowUp" || event.key === "k"
      if (next || previous) {
        event.preventDefault()
        navigate(activeIndex + (next ? 1 : -1))
      } else if (event.key === "d") {
        setDrawerOpen(true)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [activeIndex, drawerOpen, navigate])

  const reactToPaper = useAtomSet(reactToPaperAtom)
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      const target = event.target
      if (
        drawerOpen
        || event.metaKey
        || event.ctrlKey
        || event.altKey
        || target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || target instanceof HTMLButtonElement
        || target instanceof HTMLAnchorElement
      ) {
        return
      }
      const item = snapshot?.items[activeIndex]
      if (item === undefined) {
        return
      }
      const kind = event.key === "l"
        ? "like"
        : event.key === "s"
        ? "bookmark"
        : event.key === "h"
        ? "hide"
        : event.key === "o"
        ? "open-site"
        : undefined
      if (kind === undefined) {
        return
      }
      event.preventDefault()
      if (kind === "open-site") {
        if (item.paper.externalUrl === undefined) {
          return
        }
        window.open(item.paper.externalUrl, "_blank", "noopener,noreferrer")
      }
      if (kind === "hide") {
        navigate(activeIndex + 1)
      }
      reactToPaper({ kind, paperId: item.paper.id })
    }
    window.addEventListener("keydown", onShortcut)
    return () => window.removeEventListener("keydown", onShortcut)
  }, [activeIndex, drawerOpen, navigate, reactToPaper, snapshot?.items])

  const loading = snapshotAsync._tag === "Initial" || snapshotAsync.waiting
  const error = snapshotAsync._tag === "Failure" ? snapshotAsync.cause : null
  const activeItem = snapshot?.items[activeIndex]
  const announcement = activeItem === undefined
    ? undefined
    : `${activeItem.paper.title}, ${activeItem.paper.venue} ${activeItem.paper.year}, ${
      activeIndex + 1
    } of ${snapshot?.items.length ?? 0}`

  return (
    <Page fullBleed>
      <EdgeDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="The reading desk"
        description={
          <Text tone="muted">
            Set your beats and edition order.
          </Text>
        }
      >
        <Stack gap="l">
          <Card tone="subtle">
            <Stack gap="m">
              <Text tone="label" as="span">
                Academic profile
              </Text>
              <TextField
                label="Reader name"
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
              />
              <Text tone="label" as="span">
                Institution
              </Text>
              <Tabs
                id="institution-tabs"
                activeTab={institution}
                items={institutions.map((item) => ({ key: item, label: item }))}
                onChange={setInstitution}
              />
              <Text tone="label" as="span">
                Research beats
              </Text>
              <Grid layout="stats">
                {topics.filter((topic): topic is Topic => topic !== "All").map((
                  topic,
                ) => (
                  <Checkbox
                    key={topic}
                    checked={selectedTopics.includes(topic)}
                    label={topic}
                    onChange={(event) =>
                      setSelectedTopics((current) =>
                        event.currentTarget.checked
                          ? [...current, topic]
                          : current.filter((item) => item !== topic)
                      )}
                  />
                ))}
              </Grid>
              <Button
                loading={loading}
                onClick={() =>
                  saveProfile({
                    input: {
                      name: name.trim() || "Guest Reader",
                      institution,
                      interests: [...new Set(selectedTopics)],
                    },
                    query,
                  })}
              >
                Save profile
              </Button>
            </Stack>
          </Card>

          <Card>
            <Stack gap="m">
              <Text tone="label" as="span">
                Topic
              </Text>
              <Tabs
                id="topic-tabs"
                activeTab={query.topic}
                items={topics.map((topic) => ({ key: topic, label: topic }))}
                onChange={(topic) => {
                  const next = { ...query, topic }
                  setQuery(next)
                  setActiveIndex(0)
                  requestedCursors.current.clear()
                  setDrawerOpen(false)
                  loadPaperFeed(next)
                }}
              />
              <Text tone="label" as="span">
                Edition order
              </Text>
              <Tabs
                id="sort-tabs"
                activeTab={query.sort}
                items={sorts.map((sort) => ({ key: sort, label: sort }))}
                onChange={(sort) => {
                  const next = { ...query, sort }
                  setQuery(next)
                  setActiveIndex(0)
                  requestedCursors.current.clear()
                  setDrawerOpen(false)
                  loadPaperFeed(next)
                }}
              />
            </Stack>
          </Card>
        </Stack>
      </EdgeDrawer>

      {error !== null
        ? (
          <FeedDeck>
            <FeedStateSlide>
              <ErrorState
                title="The wire service faltered"
                description="The edition could not be printed. Please try again."
                actionLabel="Reload edition"
                onAction={() => loadPaperFeed(query)}
              />
            </FeedStateSlide>
          </FeedDeck>
        )
        : loading && snapshot === undefined
        ? (
          <FeedDeck>
            <FeedStateSlide>
              <Card>
                <Text>
                  Printing the front page…
                </Text>
              </Card>
            </FeedStateSlide>
          </FeedDeck>
        )
        : snapshot === undefined || snapshot.items.length === 0
        ? (
          <FeedDeck>
            <FeedStateSlide>
              <EmptyState
                title="No papers match this edition"
                description="Open the desk and choose a broader topic."
              />
            </FeedStateSlide>
          </FeedDeck>
        )
        : (
          <FeedDeck ref={deckRef} announcement={announcement}>
            {snapshot.items.map((item, index) => (
              <VisiblePaperSlide
                key={item.paper.id}
                item={item}
                index={index}
                total={snapshot.items.length}
                active={Math.abs(index - activeIndex) <= 1}
                onNavigate={navigate}
                onVisible={onVisible}
                registerNode={registerNode}
              />
            ))}
          </FeedDeck>
        )}
    </Page>
  )
}
