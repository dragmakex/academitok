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
import {
  buildFeedItems,
  buildFeedPage,
  buildFeedStats,
  savedPaperIds,
} from "@/features/papers/recommendation"
import { fetchOpenAlexPapers } from "@/lib/openalex"
import * as Clock from "effect/Clock"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

/**
 * Resolves live metadata with an offline fallback.
 * @param topic - Requested beat.
 * @param sort - Requested ordering.
 * @returns Catalog resolution effect.
 */
function resolveCatalog(
  topic: TopicFilter,
  sort: FeedRequest["query"]["sort"],
) {
  return Effect
    .gen(function*() {
      const now = yield* Clock.currentTimeMillis
      return yield* Effect.tryPromise({
        try: () => fetchOpenAlexPapers(topic, sort, now),
        catch: () => new Error("OpenAlex catalog request failed"),
      })
    })
    .pipe(Effect.catch(() => Effect.succeed(curatedPapers)))
}

export const getPaperFeedSnapshot = (request: FeedRequest) =>
  Effect
    .gen(function*() {
      const repository = yield* ReaderStateRepository
      const state = yield* repository.load
      const papers = yield* resolveCatalog(
        request.query.topic,
        request.query.sort,
      )
      // The pool is what lets /saved and permalinks resolve papers seen earlier.
      yield* repository.savePapers(papers)
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
      const page = onboarding
        ? { items: candidates.slice(0, 15), nextCursor: null }
        : buildFeedPage(candidates, request.cursor, 10, sessionSeen)
      if (request.sessionId !== undefined) {
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

      return {
        profile: state.profile,
        selectedTopic: request.query.topic,
        selectedSort: request.query.sort,
        stats: buildFeedStats(ranked),
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

    const catalog = yield* resolveCatalog("All", "latest")
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
