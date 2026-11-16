import {
  type FeedRequest,
  type ReactToPaperInput,
  type SaveProfileInput,
  type TopicFilter,
  type TrackPaperViewInput,
} from "@/api/paper-schema"
import { curatedPapers } from "@/data/papers"
import { ReaderStateRepository } from "@/db/reader-state-repository"
import {
  buildFeedItems,
  buildFeedPage,
  buildFeedStats,
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
      const ranked = buildFeedItems(
        state,
        papers,
        request.query.topic,
        request.query.sort,
      )
      const page = buildFeedPage(ranked, request.cursor)

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

export const trackPaperView = (input: TrackPaperViewInput) =>
  Effect
    .gen(function*() {
      const repository = yield* ReaderStateRepository
      yield* repository.track(input)
    })
    .pipe(Effect.withSpan("feed.impression"))

export const PapersApplicationLive = Layer.mergeAll(ReaderStateRepository.layer)
