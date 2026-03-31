import { ApiClient } from "@/api/api-client"
import type {
  CreateTodoInput,
  TodoId,
  UpdateTodoInput,
} from "@/api/todo-schema"
import { Todo, TodoGroup, TodoStats } from "@/api/todo-schema"
import { serializable } from "@/lib/atom-utils"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as ServiceMap from "effect/ServiceMap"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import * as Atom from "effect/unstable/reactivity/Atom"
import * as RpcClientError from "effect/unstable/rpc/RpcClientError"

const TodoListAsyncResultSchema = AsyncResult.Schema({
  success: Schema.Array(Todo),
  error: RpcClientError.RpcClientError,
})

const TodoStatsAsyncResultSchema = AsyncResult.Schema({
  success: TodoStats,
  error: RpcClientError.RpcClientError,
})

const TodoGroupsAsyncResultSchema = AsyncResult.Schema({
  success: Schema.Array(TodoGroup),
  error: RpcClientError.RpcClientError,
})

class Api extends ServiceMap.Service<Api>()("@app/index/Api", {
  make: Effect.gen(function*() {
    const { rpc } = yield* ApiClient

    return {
      list: () => rpc.todos_list(),
      stats: () => rpc.todos_stats(),
      groups: () => rpc.todos_groups(),
      create: (input: CreateTodoInput) => rpc.todos_create({ input }),
      update: (id: TodoId, input: UpdateTodoInput) =>
        rpc.todos_update({ id, input }),
      remove: (id: TodoId) => rpc.todos_remove({ id }),
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
 * Wraps a remote async atom so successful values can be replaced locally.
 *
 * @param remoteAtom - The remote async atom to wrap.
 * @returns A writable async atom with refresh support.
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

const todosRemoteAtom = runtime
  .atom(
    Effect.gen(function*() {
      const api = yield* Api
      return yield* api.list()
    }),
  )
  .pipe(
    serializable({
      key: "@app/index/todos",
      schema: Schema.toCodecJson(TodoListAsyncResultSchema),
    }),
  )

const todoStatsRemoteAtom = runtime
  .atom(
    Effect.gen(function*() {
      const api = yield* Api
      return yield* api.stats()
    }),
  )
  .pipe(
    serializable({
      key: "@app/index/todo-stats",
      schema: Schema.toCodecJson(TodoStatsAsyncResultSchema),
    }),
  )

const todoGroupsRemoteAtom = runtime
  .atom(
    Effect.gen(function*() {
      const api = yield* Api
      return yield* api.groups()
    }),
  )
  .pipe(
    serializable({
      key: "@app/index/todo-groups",
      schema: Schema.toCodecJson(TodoGroupsAsyncResultSchema),
    }),
  )

export const todosAtom = Object.assign(makeWritableAsyncAtom(todosRemoteAtom), {
  remote: todosRemoteAtom,
})

export const todoStatsAtom = Object.assign(
  makeWritableAsyncAtom(todoStatsRemoteAtom),
  {
    remote: todoStatsRemoteAtom,
  },
)

export const todoGroupsAtom = Object.assign(
  makeWritableAsyncAtom(todoGroupsRemoteAtom),
  {
    remote: todoGroupsRemoteAtom,
  },
)

export const createTodoAtom = runtime.fn<CreateTodoInput>()(
  Effect.fnUntraced(function*(input, get) {
    const api = yield* Api
    const snapshot = yield* api.create(input)
    get.set(todosAtom, { _tag: "Replace", value: snapshot.todos })
    get.set(todoStatsAtom, { _tag: "Replace", value: snapshot.stats })
    get.set(todoGroupsAtom, { _tag: "Replace", value: snapshot.groups })
    return snapshot
  }),
)

export const updateTodoAtom = runtime.fn<{
  readonly id: TodoId
  readonly input: UpdateTodoInput
}>()(
  Effect.fnUntraced(function*({ id, input }, get) {
    const api = yield* Api
    const snapshot = yield* api.update(id, input)
    get.set(todosAtom, { _tag: "Replace", value: snapshot.todos })
    get.set(todoStatsAtom, { _tag: "Replace", value: snapshot.stats })
    get.set(todoGroupsAtom, { _tag: "Replace", value: snapshot.groups })
    return snapshot
  }),
)

export const deleteTodoAtom = runtime.fn<TodoId>()(
  Effect.fnUntraced(function*(id, get) {
    const api = yield* Api
    const snapshot = yield* api.remove(id)
    get.set(todosAtom, { _tag: "Replace", value: snapshot.todos })
    get.set(todoStatsAtom, { _tag: "Replace", value: snapshot.stats })
    get.set(todoGroupsAtom, { _tag: "Replace", value: snapshot.groups })
    return snapshot
  }),
)
