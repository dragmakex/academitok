import { ApiClient } from "@/api/api-client"
import {
  type FeedQuery,
  type FeedRequest,
  FeedSnapshot,
  type OnboardProfileInput,
  type ReactToPaperInput,
  type SaveProfileInput,
  type Topic,
  type TrackPaperViewInput,
} from "@/api/paper-schema"
import { serializable } from "@/lib/atom-utils"
import {
  trackFeedPageEvent,
  trackPaperReactionEvent,
  trackPaperViewEvent,
} from "@/lib/feed-analytics"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import * as Atom from "effect/unstable/reactivity/Atom"
import * as RpcClientError from "effect/unstable/rpc/RpcClientError"
import { bufferImpression } from "./impression-buffer"

const FeedSnapshotAsyncResultSchema = AsyncResult.Schema({
  success: FeedSnapshot,
  error: RpcClientError.RpcClientError,
})

class Api extends Context.Service<Api>()("@app/index/Api", {
  make: Effect.gen(function*() {
    const { rpc } = yield* ApiClient

    return {
      snapshot: (request: FeedRequest) => rpc.papers_snapshot({ request }),
      saveProfile: (input: SaveProfileInput, request: FeedRequest) =>
        rpc.papers_saveProfile({ input, request }),
      onboard: (input: OnboardProfileInput) => rpc.profile_onboard({ input }),
      react: (input: ReactToPaperInput) => rpc.papers_react({ input }),
      trackViews: (inputs: ReadonlyArray<TrackPaperViewInput>) =>
        rpc.papers_trackViews({ inputs }),
    } as const
  }),
}) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(ApiClient.layer),
  )
}

export const runtime = Atom.runtime(Api.layer)

type ReplaceValue<A> = {
  readonly _tag: "Replace"
  readonly value: A
}

/**
 * Adds controlled replacement writes to a remote atom.
 * @param remoteAtom - Serializable remote atom.
 * @returns Writable atom facade.
 */
function makeWritableAsyncAtom<A>(
  remoteAtom: Atom.Atom<
    AsyncResult.AsyncResult<A, RpcClientError.RpcClientError>
  >,
) {
  return Atom.writable(
    (get) => get(remoteAtom),
    (ctx, update: ReplaceValue<A>) => {
      ctx.setSelf(AsyncResult.success(update.value))
    },
    (refresh) => {
      refresh(remoteAtom)
    },
  )
}

const defaultQuery: FeedQuery = {
  topic: "All",
  sort: "recommended",
}

const dashboardSnapshotRemoteAtom = runtime
  .atom(Effect.gen(function*() {
    const api = yield* Api
    return yield* api.snapshot({ query: defaultQuery, cursor: null })
  }))
  .pipe(
    serializable({
      key: "@app/index/paper-feed",
      schema: Schema.toCodecJson(FeedSnapshotAsyncResultSchema),
    }),
  )

export const dashboardSnapshotAtom = Object.assign(
  makeWritableAsyncAtom(dashboardSnapshotRemoteAtom),
  { remote: dashboardSnapshotRemoteAtom },
)

const replaceDashboardSnapshot = (
  get: Atom.FnContext,
  snapshot: typeof FeedSnapshot.Type,
) => {
  get.set(dashboardSnapshotAtom, { _tag: "Replace", value: snapshot })
}

export const loadPaperFeedAtom = runtime.fn<FeedQuery>()(
  Effect.fnUntraced(function*(query, get) {
    const api = yield* Api
    const snapshot = yield* api.snapshot({ query, cursor: null })
    replaceDashboardSnapshot(get, snapshot)
    trackFeedPageEvent(snapshot, null)
    return snapshot
  }),
)

export const loadNextPaperPageAtom = runtime.fn<FeedRequest>()(
  Effect.fnUntraced(function*(request, get) {
    const api = yield* Api
    const page = yield* api.snapshot(request)
    trackFeedPageEvent(page, request.cursor)
    const current = get(dashboardSnapshotAtom)
    if (current._tag !== "Success") {
      replaceDashboardSnapshot(get, page)
      return page
    }

    const ids = new Set(current.value.items.map((item) => item.paper.id))
    const snapshot = {
      ...page,
      items: [
        ...current.value.items,
        ...page.items.filter((item) => !ids.has(item.paper.id)),
      ],
    }
    replaceDashboardSnapshot(get, snapshot)
    return snapshot
  }),
)

export const saveReaderProfileAtom = runtime.fn<{
  readonly input: SaveProfileInput
  readonly query: FeedQuery
}>()(
  Effect.fnUntraced(function*({ input, query }, get) {
    const api = yield* Api
    const snapshot = yield* api.saveProfile(input, { query, cursor: null })
    replaceDashboardSnapshot(get, snapshot)
    trackFeedPageEvent(snapshot, null)
    return snapshot
  }),
)

export const onboardReaderAtom = runtime.fn<OnboardProfileInput>()(
  Effect.fnUntraced(function*(input, get) {
    const api = yield* Api
    const result = yield* api.onboard(input)
    const snapshot = yield* api.snapshot({ query: defaultQuery, cursor: null })
    replaceDashboardSnapshot(get, snapshot)
    trackFeedPageEvent(snapshot, null)
    return result
  }),
)

export const reactToPaperAtom = runtime.fn<ReactToPaperInput>()(
  Effect.fnUntraced(function*(input, get) {
    const api = yield* Api
    const result = yield* api.react(input)
    trackPaperReactionEvent(input, result.active)
    const current = get(dashboardSnapshotAtom)
    if (current._tag !== "Success") {
      return result
    }

    const snapshot = {
      ...current.value,
      items: current
        .value
        .items
        .map((item) =>
          item.paper.id !== result.paperId
            ? item
            : result.kind === "like"
            ? { ...item, liked: result.active }
            : result.kind === "bookmark"
            ? { ...item, bookmarked: result.active }
            : item
        )
        .filter((item) =>
          result.kind !== "hide"
          || !result.active
          || item.paper.id !== result.paperId
        ),
    }
    replaceDashboardSnapshot(get, snapshot)
    return result
  }),
)

const impressionQueueAtom = Atom.make<ReadonlyArray<TrackPaperViewInput>>([])

type TrackPaperViewCommand = {
  readonly event?: TrackPaperViewInput
  readonly topics?: ReadonlyArray<Topic>
  readonly flush?: boolean
}

export const trackPaperViewAtom = runtime.fn<TrackPaperViewCommand>()(
  Effect.fnUntraced(function*(command, get) {
    if (command.event !== undefined) {
      trackPaperViewEvent(command.event, command.topics ?? [])
    }
    const { batch, queued } = bufferImpression(
      get(impressionQueueAtom),
      command.event,
      command.flush === true,
    )
    get.set(impressionQueueAtom, queued)
    if (batch.length === 0) {
      return
    }

    const api = yield* Api
    yield* api.trackViews(batch)
  }),
)
