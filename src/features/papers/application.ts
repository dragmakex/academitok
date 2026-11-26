import {
  type FeedRequest,
  type OnboardProfileInput,
  type ReactToPaperInput,
  type SaveProfileInput,
  type TopicFilter,
  type TrackPaperViewsInput,
} from "@/api/paper-schema"
import { curatedPapers } from "@/data/papers"
import { ReaderStateRepository } from "@/db/reader-state-repository"
import { formatBibtex } from "@/features/papers/citation"
import {
  buildFeedItems,
  buildFeedPage,
  recentPaperIds,
  savedPaperIds,
} from "@/features/papers/recommendation"
import { fetchOpenAlexPapers } from "@/lib/openalex"
import { ReaderId } from "@/lib/reader-id"
import * as Clock from "effect/Clock"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

/** Pool coverage needed before a page is served without an upstream request. */
const poolPageThreshold = 10 * 3

/**
 * Resolves live metadata with an offline fallback, preferring the stored pool.
 * @param topic - Requested topic.
 * @param sort - Requested ordering.
 * @returns Catalog papers and the origin they were resolved from.
 */
function resolveCatalog(
  topic: TopicFilter,
  sort: FeedRequest["query"]["sort"],
) {
  return Effect
    .gen(function*() {
      const repository = yield* ReaderStateRepository
      const now = yield* Clock.currentTimeMillis
      const pooled = (yield* repository.recentPapers(new Date(now))).filter(
        (paper) => topic === "All" || paper.topics.includes(topic),
      )
      if (pooled.length >= poolPageThreshold) {
        return { papers: pooled, origin: "pool" as const }
      }

      return yield* Effect
        .tryPromise({
          try: () => fetchOpenAlexPapers(topic, sort, now),
          catch: () => new Error("OpenAlex catalog request failed"),
        })
        .pipe(
          Effect.tap((papers) => repository.savePapers(papers)),
          Effect.map((papers) => ({ papers, origin: "live" as const })),
          Effect.catch(() =>
            Effect.succeed({ papers: curatedPapers, origin: "seed" as const })
          ),
        )
    })
}

export const getPaperFeedSnapshot = (request: FeedRequest) =>
  Effect
    .gen(function*() {
      const repository = yield* ReaderStateRepository
      const readerId = yield* ReaderId
      const state = yield* repository.load
      const now = yield* Clock.currentTimeMillis
      const { papers, origin } = yield* resolveCatalog(
        request.query.topic,
        request.query.sort,
      )
      const ranked = buildFeedItems(
        state,
        papers,
        request.query.topic,
        request.query.sort,
      )
      const onboarding = state.profile === null
      const sessionSeen: ReadonlyArray<string> = request.sessionId === undefined
        ? []
        : yield* repository.loadFeedSession(request.sessionId)
      const onboardingSignals = state.reactions.filter((reaction) =>
        reaction.kind === "onboard-keep"
        || reaction.kind === "onboard-reject"
      )
      const viewCount = state
        .reactions
        .filter((reaction) => reaction.kind === "view")
        .length
      const skipped = state.profile?.interests.length === 0
        && onboardingSignals.length === 0
      const candidates = skipped && viewCount < 20
        ? ranked.map((item) => ({ ...item, exploration: true }))
        : ranked
      const recent = recentPaperIds(state.reactions, now)
      const fresh = candidates.filter((item) => !recent.has(item.paper.id))
      const repeats = ranked.filter((item) => recent.has(item.paper.id))
      const edition = request.edition
      const pinned = edition === undefined ? undefined : new Map(
        ranked.map((item) => [item.paper.id, item] as const),
      )
      const page = edition === undefined || pinned === undefined
        ? onboarding
          ? { items: candidates.slice(0, 15), nextCursor: null }
          : buildFeedPage(
            fresh,
            request.cursor,
            10,
            sessionSeen,
            repeats,
            request.query.topic === "All" ? undefined : request.query.topic,
          )
        : {
          items: edition.flatMap((id) => {
            const item = pinned.get(id)
            return item === undefined ? [] : [item]
          }),
          nextCursor: null,
        }
      if (edition === undefined && request.sessionId !== undefined) {
        yield* repository.saveFeedSession(
          request.sessionId,
          [
            ...new Set([
              ...sessionSeen,
              ...page.items.map((item) => item.paper.id),
            ]),
          ],
          page.nextCursor,
        )
      }

      const pageIds = page.items.map((item) => item.paper.id)
      const alsoKeptBy = yield* repository.filedByOthers(pageIds, readerId)
      const alsoLikedBy = yield* repository.likedByOthers(pageIds, readerId)

      return {
        origin,
        pinned: edition !== undefined,
        alsoKeptBy,
        alsoLikedBy,
        profile: state.profile,
        selectedTopic: request.query.topic,
        selectedSort: request.query.sort,
        items: page.items,
        nextCursor: page.nextCursor,
        exploration: page.items.filter((item) => item.exploration).length,
      }
    })
    .pipe(Effect.withSpan("feed.next"))

export const getSavedPapers = Effect
  .gen(function*() {
    const repository = yield* ReaderStateRepository
    const state = yield* repository.load
    const savedIds = savedPaperIds(state)
    if (savedIds.length === 0) {
      return { items: [], nextCursor: null, exploration: 0 }
    }

    const { papers: catalog } = yield* resolveCatalog("All", "latest")
    const pooled = yield* repository.papersByIds(
      savedIds.filter((id) => !catalog.some((paper) => paper.id === id)),
    )
    const items = new Map(
      buildFeedItems(state, [...catalog, ...pooled], "All", "latest").map(
        (item) => [item.paper.id, item] as const,
      ),
    )

    return {
      items: savedIds.flatMap((id) => {
        const item = items.get(id)
        return item === undefined ? [] : [item]
      }),
      nextCursor: null,
      exploration: 0,
    }
  })
  .pipe(Effect.withSpan("saved.list"))

export const getSavedBibtex = Effect
  .gen(function*() {
    const page = yield* getSavedPapers
    return formatBibtex(page.items.map((item) => item.paper))
  })
  .pipe(Effect.withSpan("saved.bibtex"))

export const getPaperById = (id: string) =>
  Effect
    .gen(function*() {
      const repository = yield* ReaderStateRepository
      const [pooled] = yield* repository.papersByIds([id])
      if (pooled !== undefined) {
        return pooled
      }

      return curatedPapers.find((paper) => paper.id === id) ?? null
    })
    .pipe(Effect.withSpan("paper.byId"))

export const getPaperBibtex = (id: string) =>
  Effect
    .gen(function*() {
      const paper = yield* getPaperById(id)
      return paper === null ? "" : formatBibtex([paper])
    })
    .pipe(Effect.withSpan("paper.bibtex"))

export const getPaperAudience = (id: string) =>
  Effect
    .gen(function*() {
      const repository = yield* ReaderStateRepository
      return yield* repository.savedByReaders(id)
    })
    .pipe(Effect.withSpan("paper.audience"))

export const getPaperOpenedBy = (id: string) =>
  Effect
    .gen(function*() {
      const repository = yield* ReaderStateRepository
      return yield* repository.openedByReaders(id)
    })
    .pipe(Effect.withSpan("paper.opened-by"))

export const getPaperLikedBy = (id: string) =>
  Effect
    .gen(function*() {
      const repository = yield* ReaderStateRepository
      return yield* repository.likedByReaders(id)
    })
    .pipe(Effect.withSpan("paper.liked-by"))

export const getPaperHiddenBy = (id: string) =>
  Effect
    .gen(function*() {
      const repository = yield* ReaderStateRepository
      return yield* repository.hiddenByReaders(id)
    })
    .pipe(Effect.withSpan("paper.hidden-by"))

export const getSavedAudience: Effect.Effect<
  Record<string, number>,
  never,
  ReaderStateRepository | ReaderId
> = Effect
  .gen(function*() {
    const repository = yield* ReaderStateRepository
    const readerId = yield* ReaderId
    const savedIds = savedPaperIds(yield* repository.load)
    return savedIds.length === 0
      ? {}
      : yield* repository.filedByOthers(savedIds, readerId)
  })
  .pipe(Effect.withSpan("saved.audience"))

export const saveReaderProfile = (
  input: SaveProfileInput,
  request: FeedRequest,
) =>
  Effect
    .gen(function*() {
      const repository = yield* ReaderStateRepository
      yield* repository.saveProfile(input)
      return yield* getPaperFeedSnapshot(request)
    })
    .pipe(Effect.withSpan("PapersApp.saveProfile"))

export const onboardReader = (input: OnboardProfileInput) =>
  Effect
    .gen(function*() {
      const repository = yield* ReaderStateRepository
      yield* repository.onboard(input)
      return { seeded: true as const }
    })
    .pipe(Effect.withSpan("profile.onboard"))

export const reactToPaper = (input: ReactToPaperInput) =>
  Effect
    .gen(function*() {
      const repository = yield* ReaderStateRepository
      const active = yield* repository.react(input)

      return {
        paperId: input.paperId,
        kind: input.kind,
        active,
      }
    })
    .pipe(Effect.withSpan("PapersApp.react"))

export const trackPaperViews = (inputs: TrackPaperViewsInput) =>
  Effect
    .gen(function*() {
      const repository = yield* ReaderStateRepository
      yield* Effect.forEach(inputs, (input) => repository.track(input), {
        discard: true,
      })
    })
    .pipe(Effect.withSpan("impression.flush"))

export const PapersApplicationLive = Layer.mergeAll(ReaderStateRepository.layer)
