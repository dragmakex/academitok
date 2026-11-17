import { ApiClient } from "@/api/api-client"
import {
  type FeedItem,
  type FeedOrigin,
  FeedPage as FeedPageSchema,
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
  recordEdition,
  trackFeedPageEvent,
  trackPaperReactionEvent,
  trackPaperViewEvent,
} from "@/lib/feed-analytics"
import {
  appendPaperPage,
  type RemovedItem,
  removeItemAt,
  restoreItem,
} from "@/lib/feed-items"
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

const FeedPageAsyncResultSchema = AsyncResult.Schema({
  success: FeedPageSchema,
  error: RpcClientError.RpcClientError,
})

/** One feed session per page load; the server persists its seen papers. */
const feedSessionId = globalThis.crypto.randomUUID()

/** Origins of the pages this session loaded, so the desk can read the cold-feed rate. */
export const editionOriginsAtom = Atom.make<ReadonlyArray<FeedOrigin>>([])

/** Reaction the server refused, so the deck can say the write never reached the desk. */
export const reactionFailureAtom = Atom.make<
  ReactToPaperInput["kind"] | null
>(null)

/**
 * Records a refused reaction while leaving the write's failure in the atom result.
 * @param effect - Reaction write.
 * @param kind - Reaction kind the write carries.
 * @param get - Atom write context.
 * @returns The write, with the refused kind recorded on failure.
 */
const recordReactionFailure = <A, E>(
  effect: Effect.Effect<A, E>,
  kind: ReactToPaperInput["kind"],
  get: Atom.FnContext,
): Effect.Effect<A, E> =>
  effect.pipe(
    Effect.tapError(() =>
      Effect.sync(() => get.set(reactionFailureAtom, kind))
    ),
  )

/**
 * Adds a served page's origin to the session's edition tally.
 * @param get - Atom write context.
 * @param origin - Origin of the page just served.
 */
const recordEditionOrigin = (get: Atom.FnContext, origin: FeedOrigin) => {
  get.set(editionOriginsAtom, recordEdition(get(editionOriginsAtom), origin))
}

class Api extends Context.Service<Api>()("@app/index/Api", {
  make: Effect.gen(function*() {
    const { rpc } = yield* ApiClient
    const withSession = (request: FeedRequest): FeedRequest => ({
      ...request,
      sessionId: feedSessionId,
    })

    return {
      snapshot: (request: FeedRequest) =>
        rpc.papers_snapshot({ request: withSession(request) }),
      saveProfile: (input: SaveProfileInput, request: FeedRequest) =>
        rpc.papers_saveProfile({ input, request: withSession(request) }),
      onboard: (input: OnboardProfileInput) => rpc.profile_onboard({ input }),
      react: (input: ReactToPaperInput) => rpc.papers_react({ input }),
      trackViews: (inputs: ReadonlyArray<TrackPaperViewInput>) =>
        rpc.papers_trackViews({ inputs }),
      savedList: () => rpc.papers_savedList(),
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

const savedPageRemoteAtom = runtime
  .atom(Effect.gen(function*() {
    const api = yield* Api
    return yield* api.savedList()
  }))
  .pipe(
    serializable({
      key: "@app/saved/clippings",
      schema: Schema.toCodecJson(FeedPageAsyncResultSchema),
    }),
  )

export const savedPageAtom = Object.assign(
  makeWritableAsyncAtom(savedPageRemoteAtom),
  { remote: savedPageRemoteAtom },
)

export const removeSavedPaperAtom = runtime.fn<string>()(
  Effect.fnUntraced(function*(paperId, get) {
    const api = yield* Api
    const input = { kind: "bookmark", paperId } as const
    const result = yield* recordReactionFailure(
      api.react(input),
      input.kind,
      get,
    )
    trackPaperReactionEvent(input, result.active)
    const page = yield* api.savedList()
    get.set(savedPageAtom, { _tag: "Replace", value: page })
    return page
  }),
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
    recordEditionOrigin(get, snapshot.origin)
    replaceDashboardSnapshot(get, snapshot)
    trackFeedPageEvent(snapshot, null)
    return snapshot
  }),
)

export const loadNextPaperPageAtom = runtime.fn<FeedRequest>()(
  Effect.fnUntraced(function*(request, get) {
    const api = yield* Api
    const page = yield* api.snapshot(request)
    recordEditionOrigin(get, page.origin)
    trackFeedPageEvent(page, request.cursor)
    const current = get(dashboardSnapshotAtom)
    if (current._tag !== "Success") {
      replaceDashboardSnapshot(get, page)
      return page
    }

    const snapshot = appendPaperPage(current.value, page)
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
    recordEditionOrigin(get, snapshot.origin)
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
    recordEditionOrigin(get, snapshot.origin)
    replaceDashboardSnapshot(get, snapshot)
    trackFeedPageEvent(snapshot, null)
    return result
  }),
)

export const reactToPaperAtom = runtime.fn<ReactToPaperInput>()(
  Effect.fnUntraced(function*(input, get) {
    const api = yield* Api
    const result = yield* recordReactionFailure(
      api.react(input),
      input.kind,
      get,
    )
    trackPaperReactionEvent(input, result.active)
    const current = get(dashboardSnapshotAtom)
    if (current._tag !== "Success") {
      return result
    }

    const items = current.value.items.map((item) =>
      item.paper.id !== result.paperId
        ? item
        : result.kind === "like"
        ? { ...item, liked: result.active }
        : result.kind === "bookmark"
        ? { ...item, bookmarked: result.active }
        : item
    )
    const hiddenIndex = result.kind === "hide" && result.active
      ? items.findIndex((item) => item.paper.id === result.paperId)
      : -1

    replaceDashboardSnapshot(get, {
      ...current.value,
      items: hiddenIndex < 0 ? items : removeItemAt(items, hiddenIndex).items,
    })
    return result
  }),
)

export const restoreHiddenPaperAtom = runtime.fn<RemovedItem<FeedItem>>()(
  Effect.fnUntraced(function*(removed, get) {
    const api = yield* Api
    const input = { kind: "hide", paperId: removed.item.paper.id } as const
    const result = yield* recordReactionFailure(
      api.react(input),
      input.kind,
      get,
    )
    trackPaperReactionEvent(input, result.active)
    const current = get(dashboardSnapshotAtom)
    if (current._tag !== "Success") {
      return result
    }

    replaceDashboardSnapshot(get, {
      ...current.value,
      items: restoreItem(current.value.items, removed),
    })
    return result
  }),
)

const impressionQueueAtom = Atom.make<ReadonlyArray<TrackPaperViewInput>>([])

type TrackPaperViewCommand = {
  readonly event?: TrackPaperViewInput
  readonly topics?: ReadonlyArray<Topic>
  readonly readMinutes?: number | null
  readonly flush?: boolean
}

export const trackPaperViewAtom = runtime.fn<TrackPaperViewCommand>()(
  Effect.fnUntraced(function*(command, get) {
    if (command.event !== undefined) {
      trackPaperViewEvent(
        command.event,
        command.topics ?? [],
        command.readMinutes,
      )
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
