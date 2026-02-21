import { ApiClient } from "@/api/api-client"
import type {
  CreateTodoInput,
  TodoId,
  UpdateTodoInput,
} from "@/api/todo-schema"
import { Todo } from "@/api/todo-schema"
import { serializable } from "@/lib/atom-utils"
import * as Arr from "effect/Array"
import type * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as ServiceMap from "effect/ServiceMap"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import * as Atom from "effect/unstable/reactivity/Atom"
import * as RpcClientError from "effect/unstable/rpc/RpcClientError"

const TodosSchema = Schema.Array(Todo)

class Api extends ServiceMap.Service<Api>()("@app/index/Api", {
  make: Effect.gen(function*() {
    const { rpc } = yield* ApiClient

    return {
      list: () => rpc.todos_list(),
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

type TodosCacheUpdate = Data.TaggedEnum<{
  Upsert: { readonly todo: Todo }
  Delete: { readonly id: TodoId }
}>

export const todosAtom = (() => {
  const remoteAtom = runtime
    .atom(
      Effect.gen(function*() {
        const api = yield* Api
        return yield* api.list()
      }),
    )
    .pipe(
      serializable({
        key: "@app/index/todos",
        schema: Schema.toCodecJson(AsyncResult.Schema({
          success: TodosSchema,
          error: RpcClientError.RpcClientError,
        })),
      }),
    )

  return Object.assign(
    Atom.writable(
      (get) => get(remoteAtom),
      (ctx, update: TodosCacheUpdate) => {
        const current = ctx.get(todosAtom)
        if (!AsyncResult.isSuccess(current)) {
          return
        }

        const nextValue = (() => {
          switch (update._tag) {
            case "Upsert": {
              const existingIndex = Arr.findFirstIndex(
                current.value,
                (t) => t.id === update.todo.id,
              )
              return existingIndex === undefined
                ? Arr.prepend(current.value, update.todo)
                : Arr.replace(current.value, existingIndex, update.todo)
                  ?? current.value
            }
            case "Delete": {
              return Arr.filter(current.value, (t) => t.id !== update.id)
            }
          }
          const _exhaustive: never = update
          return _exhaustive
        })()

        ctx.setSelf(AsyncResult.success(nextValue))
      },
      (refresh) => {
        refresh(remoteAtom)
      },
    ),
    { remote: remoteAtom },
  )
})()

export const createTodoAtom = runtime.fn<CreateTodoInput>()(
  Effect.fnUntraced(function*(input, get) {
    const api = yield* Api
    const result = yield* api.create(input)
    get.set(todosAtom, { _tag: "Upsert", todo: result })
    return result
  }),
)

export const updateTodoAtom = runtime.fn<{
  readonly id: TodoId
  readonly input: UpdateTodoInput
}>()(
  Effect.fnUntraced(function*({ id, input }, get) {
    const api = yield* Api
    const result = yield* api.update(id, input)
    get.set(todosAtom, { _tag: "Upsert", todo: result })
    return result
  }),
)

export const deleteTodoAtom = runtime.fn<TodoId>()(
  Effect.fnUntraced(function*(id, get) {
    const api = yield* Api
    yield* api.remove(id)
    get.set(todosAtom, { _tag: "Delete", id })
  }),
)
