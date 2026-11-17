import {
  type FeedItem,
  type FeedOrigin,
  type FeedQuery,
  type Topic,
  type TopicFilter,
} from "@/api/paper-schema"
import { Button } from "@/design-system/components/Button"
import { Card } from "@/design-system/components/Card"
import { Checkbox } from "@/design-system/components/Checkbox"
import { CopyBlock } from "@/design-system/components/CopyBlock"
import { EdgeDrawer } from "@/design-system/components/EdgeDrawer"
import { EmptyState } from "@/design-system/components/EmptyState"
import { ErrorState } from "@/design-system/components/ErrorState"
import { FeedDeck } from "@/design-system/components/FeedDeck"
import { FeedStateSlide } from "@/design-system/components/FeedStateSlide"
import { Notice, type NoticeAction } from "@/design-system/components/Notice"
import { Page } from "@/design-system/components/Page"
import { PaperSlide } from "@/design-system/components/PaperSlide"
import { ShortcutSheet } from "@/design-system/components/ShortcutSheet"
import { StatCard } from "@/design-system/components/StatCard"
import { Tabs } from "@/design-system/components/Tabs"
import { Text } from "@/design-system/components/Text"
import { TextField } from "@/design-system/components/TextField"
import { Grid } from "@/design-system/primitives/Grid"
import { Inline } from "@/design-system/primitives/Inline"
import { Stack } from "@/design-system/primitives/Stack"
import { formatEdition } from "@/features/papers/citation"
import {
  archivalDrift,
  citationAgeSkew,
  topicEntropy,
  trackFeedPageEvent,
} from "@/lib/feed-analytics"
import { deckAction, shortcutRows } from "@/lib/shortcuts"
import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  dashboardSnapshotAtom,
  loadNextPaperPageAtom,
  loadPaperFeedAtom,
  onboardReaderAtom,
  reactToPaperAtom,
  restoreHiddenPaperAtom,
  saveReaderProfileAtom,
  trackPaperViewAtom,
} from "./atoms"
import { flushImpressionsOnHide } from "./impression-buffer"

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

/**
 * Renders a rate as a percentage, dropping a trailing `.0` (2.0% and 12%).
 * @param rate - Share of the measurement window.
 * @returns Percentage label.
 */
const formatRate = (rate: number): string =>
  `${(rate * 100).toFixed(1).replace(/\.0$/, "")}%`

type VisiblePaperSlideProps = {
  readonly active: boolean
  readonly index: number
  readonly item: FeedItem
  readonly origin: FeedOrigin
  readonly total: number
  readonly onBookmark: () => void
  readonly onHide: () => void
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
 * @param root0.origin - Where the edition came from.
 * @param root0.total - Mounted feed length.
 * @param root0.onBookmark - Save reaction callback.
 * @param root0.onHide - Hide reaction callback.
 * @param root0.onNavigate - Navigation callback.
 * @param root0.onVisible - Visibility callback.
 * @param root0.registerNode - Slide registration callback.
 * @returns Tracked paper slide.
 */
function VisiblePaperSlide({
  active,
  index,
  item,
  onBookmark,
  onHide,
  onNavigate,
  onVisible,
  origin,
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
    const takeDwell = () => {
      if (!armed.current || dwellSent.current || visibleAt.current === null) {
        return undefined
      }
      dwellSent.current = true
      return {
        paperId: item.paper.id,
        kind: "dwell" as const,
        dwellMs: Math.max(0, performance.now() - visibleAt.current),
        position: index,
        exploration: item.exploration,
      }
    }
    const sendDwell = () => {
      const event = takeDwell()
      if (event !== undefined) {
        trackView({
          event,
          topics: item.paper.topics,
          readMinutes: item.paper.readMinutes,
        })
      }
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendDwell()
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange, true)

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
            event: {
              paperId: item.paper.id,
              kind: "view",
              dwellMs: 0,
              position: index,
              exploration: item.exploration,
            },
            topics: item.paper.topics,
            readMinutes: item.paper.readMinutes,
          })
        }, 400)
      },
      { threshold: 0.6 },
    )

    observer.observe(node)
    return () => {
      clearArmTimer()
      sendDwell()
      document.removeEventListener("visibilitychange", onVisibilityChange, true)
      observer.disconnect()
    }
  }, [
    index,
    item.exploration,
    item.paper.id,
    item.paper.readMinutes,
    onVisible,
    trackView,
  ])

  const react = (kind: "like" | "open-site") => {
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
      origin={origin}
      total={total}
      skeleton={!active}
      actions={{
        onLike: () => react("like"),
        onBookmark,
        onHide,
        onOpenSite: () => react("open-site"),
        onPrevious: () => onNavigate(index - 1),
        onNext: () => onNavigate(index + 1),
      }}
    />
  )
}

type OnboardingPicksProps = {
  readonly candidates: ReadonlyArray<FeedItem>
  readonly onSubmit: (
    input:
      | {
        readonly keptPaperIds: ReadonlyArray<string>
        readonly rejectedPaperIds: ReadonlyArray<string>
        readonly skipped: false
      }
      | {
        readonly keptPaperIds: readonly []
        readonly rejectedPaperIds: readonly []
        readonly skipped: true
      },
  ) => void
}

/**
 * Collects cold-start paper picks in three groups of five.
 * @param root0 - Onboarding props.
 * @param root0.candidates - Candidate papers.
 * @param root0.onSubmit - Completed selection callback.
 * @returns Onboarding selection surface.
 */
export function OnboardingPicks(
  { candidates, onSubmit }: OnboardingPicksProps,
) {
  const [page, setPage] = useState(0)
  const [decisions, setDecisions] = useState<
    Readonly<Record<string, "keep" | "discard">>
  >({})
  const visible = candidates.slice(page * 5, page * 5 + 5)
  const pageComplete = visible.length === 5
    && visible.every((item) => decisions[item.paper.id] !== undefined)
  const keptPaperIds = candidates
    .filter((item) => decisions[item.paper.id] === "keep")
    .map((item) => item.paper.id)
  const rejectedPaperIds = candidates
    .filter((item) => decisions[item.paper.id] === "discard")
    .map((item) => item.paper.id)

  return (
    <FeedDeck>
      <FeedStateSlide>
        <Card>
          <Stack gap="m">
            <Stack gap="xs">
              <Text tone="label" as="span">
                Set your front page · {page + 1} of 3
              </Text>
              <Text>
                Keep at least five papers. Your choices tune topics and writing
                similarity before the first edition.
              </Text>
            </Stack>
            <Grid layout="stats">
              {visible.map((item) => (
                <Card key={item.paper.id} tone="subtle">
                  <Stack gap="s">
                    <Text tone="label" as="span">
                      {item.paper.topics[0] ?? "Research"}
                    </Text>
                    <Text>
                      {item.paper.title}
                    </Text>
                    <Inline gap="s">
                      <Button
                        variant={decisions[item.paper.id] === "keep"
                          ? "primary"
                          : "secondary"}
                        aria-label={`Keep ${item.paper.title}`}
                        aria-pressed={decisions[item.paper.id] === "keep"}
                        onClick={() =>
                          setDecisions((current) => ({
                            ...current,
                            [item.paper.id]: "keep",
                          }))}
                      >
                        Keep scrolling
                      </Button>
                      <Button
                        variant={decisions[item.paper.id] === "discard"
                          ? "danger"
                          : "ghost"}
                        aria-label={`Discard ${item.paper.title}`}
                        aria-pressed={decisions[item.paper.id] === "discard"}
                        onClick={() =>
                          setDecisions((current) => ({
                            ...current,
                            [item.paper.id]: "discard",
                          }))}
                      >
                        Discard
                      </Button>
                    </Inline>
                  </Stack>
                </Card>
              ))}
            </Grid>
            <Inline gap="s" align="between">
              <Button
                variant="ghost"
                onClick={() =>
                  onSubmit({
                    keptPaperIds: [],
                    rejectedPaperIds: [],
                    skipped: true,
                  })}
              >
                Just show me the front page
              </Button>
              {page < 2
                ? (
                  <Button
                    disabled={!pageComplete}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next five
                  </Button>
                )
                : (
                  <Button
                    disabled={!pageComplete || keptPaperIds.length < 5}
                    onClick={() =>
                      onSubmit({
                        keptPaperIds,
                        rejectedPaperIds,
                        skipped: false,
                      })}
                  >
                    Print my edition
                  </Button>
                )}
            </Inline>
          </Stack>
        </Card>
      </FeedStateSlide>
    </FeedDeck>
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
  const onboardReader = useAtomSet(onboardReaderAtom)
  const saveProfile = useAtomSet(saveReaderProfileAtom)
  const trackView = useAtomSet(trackPaperViewAtom)
  const snapshot = snapshotAsync._tag === "Success"
    ? snapshotAsync.value
    : undefined

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [notice, setNotice] = useState<
    {
      readonly label: string
      readonly action?: NoticeAction | undefined
    } | null
  >(null)
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
  const initialFeedTracked = useRef(false)

  useEffect(() => {
    if (snapshot !== undefined && !initialFeedTracked.current) {
      initialFeedTracked.current = true
      trackFeedPageEvent(snapshot, null)
    }
  }, [snapshot])

  useEffect(
    () =>
      flushImpressionsOnHide(document, () => {
        trackView({ flush: true })
      }),
    [trackView],
  )

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

  const reactToPaper = useAtomSet(reactToPaperAtom)
  const restorePaper = useAtomSet(restoreHiddenPaperAtom)

  useEffect(() => {
    if (notice === null) {
      return
    }
    const timer = window.setTimeout(() => setNotice(null), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const hideClipping = useCallback((index: number) => {
    const item = snapshot?.items[index]
    if (item === undefined) {
      return
    }
    navigate(index + 1)
    reactToPaper({ kind: "hide", paperId: item.paper.id })
    setNotice({
      label: "Clipped out",
      action: {
        label: "Undo",
        onAction: () => {
          setNotice(null)
          restorePaper({ item, index })
          navigate(index)
        },
      },
    })
  }, [navigate, reactToPaper, restorePaper, snapshot?.items])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (event.key === "Escape") {
        if (notice !== null && !drawerOpen && !sheetOpen) {
          setNotice(null)
        }
        return
      }

      const formField = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
      const control = target instanceof HTMLButtonElement
        || target instanceof HTMLAnchorElement
      const action = deckAction(
        event.key,
        formField ? "form" : control ? "control" : "deck",
        sheetOpen ? "sheet" : drawerOpen ? "desk" : "none",
      )
      if (action === undefined) {
        return
      }
      event.preventDefault()

      if (action === "help") {
        setSheetOpen((current) => !current)
        return
      }

      const item = snapshot?.items[activeIndex]
      switch (action) {
        case "next":
          navigate(activeIndex + 1)
          return
        case "previous":
          navigate(activeIndex - 1)
          return
        case "desk":
          setDrawerOpen(true)
          return
        default:
          if (item === undefined) {
            return
          }
          if (
            action === "open-site"
            && item.paper.externalUrl !== undefined
          ) {
            window.open(item.paper.externalUrl, "_blank", "noopener,noreferrer")
          }
          if (action === "hide") {
            hideClipping(activeIndex)
            return
          }
          reactToPaper({ kind: action, paperId: item.paper.id })
          if (action === "bookmark") {
            setNotice({ label: "Filed in clippings" })
          }
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [
    activeIndex,
    drawerOpen,
    hideClipping,
    navigate,
    notice,
    reactToPaper,
    sheetOpen,
    snapshot?.items,
  ])

  const loading = snapshotAsync._tag === "Initial" || snapshotAsync.waiting
  const error = snapshotAsync._tag === "Failure" ? snapshotAsync.cause : null
  const activeItem = snapshot?.items[activeIndex]
  const announcement = activeItem === undefined
    ? undefined
    : `${activeItem.paper.title}, ${activeItem.paper.venue} ${activeItem.paper.year}, ${
      activeIndex + 1
    } of ${snapshot?.items.length ?? 0}`
  const pagePapers = (snapshot?.items ?? []).map((item) => item.paper)
  const drift = archivalDrift(pagePapers.map((paper) => paper.year))
  const skew = citationAgeSkew(pagePapers)
  const entropy = topicEntropy(pagePapers)
  const medianDwellMs = snapshot?.stats.medianDwellMs ?? null
  const medianCompletion = snapshot?.stats.medianCompletion ?? null
  const hideRate = snapshot?.stats.hideRate ?? null
  const openSourceRate = snapshot?.stats.openSourceRate ?? null
  const savesPerHundred = snapshot?.stats.savesPerHundred ?? null
  const windowTopicEntropy = snapshot?.stats.windowTopicEntropy ?? null
  const beats = new Set(
    pagePapers.flatMap((paper) =>
      paper.topics[0] === undefined ? [] : [paper.topics[0]]
    ),
  )
    .size
  const editionNotice = formatEdition(
    (snapshot?.items ?? []).map((item) => item.paper),
    "Evening Edition",
  )

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
          <Stack gap="m">
            <Text tone="label" as="span">
              Archival drift
            </Text>
            <Grid layout="stats">
              <StatCard
                label="Median year"
                value={drift.medianYear ?? "—"}
                helper={`of ${drift.total} loaded clippings`}
              />
              <StatCard
                label="A decade behind"
                value={drift.olderThanDecade}
                helper={drift.newestYear === null
                  ? "no publication years on the page"
                  : `older than ${drift.newestYear}, the newest`}
              />
              <StatCard
                label="Citations, older half"
                value={skew.olderCitations ?? "—"}
                helper="median behind the page's median year"
              />
              <StatCard
                label="Citations, newer half"
                value={skew.newerCitations ?? "—"}
                helper="median on or after the median year"
              />
            </Grid>
            <CopyBlock
              actionLabel="Copy edition"
              announcement="Edition copied to the clipboard"
              label="Share this edition"
              text={editionNotice}
            />
          </Stack>

          <Stack gap="m">
            <Text tone="label" as="span">
              Topic mix
            </Text>
            <Grid layout="stats">
              <StatCard
                label="Entropy"
                value={snapshot === undefined ? "—" : entropy.toFixed(2)}
                helper="nats across the page's primary beats"
              />
              <StatCard
                label="Beats on the page"
                value={snapshot === undefined ? "—" : beats}
                helper={`of ${drift.total} loaded clippings`}
              />
              <StatCard
                label="Last 50 impressions"
                value={windowTopicEntropy === null
                  ? "—"
                  : windowTopicEntropy.toFixed(2)}
                helper="nats against the 1.6 floor"
              />
            </Grid>
          </Stack>

          <Stack gap="m">
            <Text tone="label" as="span">
              Reading pace
            </Text>
            <Grid layout="stats">
              <StatCard
                label="Median dwell"
                value={medianDwellMs === null
                  ? "—"
                  : `${(medianDwellMs / 1000).toFixed(1)} s`}
                helper="against the 8 s target"
              />
              <StatCard
                label="Median completion"
                value={medianCompletion === null
                  ? "—"
                  : `${Math.round(medianCompletion * 100)}%`}
                helper="against the 100% target"
              />
              <StatCard
                label="Hide rate"
                value={hideRate === null ? "—" : formatRate(hideRate)}
                helper="against the 3% ceiling"
              />
              <StatCard
                label="Open-source rate"
                value={openSourceRate === null
                  ? "—"
                  : formatRate(openSourceRate)}
                helper="against the 12% floor"
              />
              <StatCard
                label="Saves per 100 impressions"
                value={savesPerHundred === null
                  ? "—"
                  : savesPerHundred.toFixed(1)}
                helper="against the 1.0 target"
              />
            </Grid>
          </Stack>

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

      <ShortcutSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Keyboard shortcuts"
        items={shortcutRows}
      />

      {notice === null
        ? null
        : <Notice label={notice.label} action={notice.action} />}

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
        : snapshot?.profile === null && snapshot.items.length === 15
        ? (
          <OnboardingPicks
            candidates={snapshot.items}
            onSubmit={onboardReader}
          />
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
                origin={snapshot.origin}
                index={index}
                total={snapshot.items.length}
                active={Math.abs(index - activeIndex) <= 1}
                onBookmark={() => {
                  reactToPaper({ kind: "bookmark", paperId: item.paper.id })
                  setNotice({ label: "Filed in clippings" })
                }}
                onHide={() => hideClipping(index)}
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
