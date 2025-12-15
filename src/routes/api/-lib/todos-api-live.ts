import { DomainApi } from "@/api/domain-api"
import type {
  CreateTodoInput,
  TodoId,
  UpdateTodoInput,
} from "@/api/todo-schema"
import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { TodosService } from "./todos-service"

/**
 * HTTP API handler implementations.
 * These are exported separately for testing.
 */
export const listHandler = Effect.gen(function*() {
  const todos = yield* TodosService
  return yield* todos.list
})

export const getByIdHandler = (id: TodoId) =>
  Effect.gen(function*() {
    const todos = yield* TodosService
    return yield* todos.getById(id)
  })

export const createHandler = (payload: CreateTodoInput) =>
  Effect.gen(function*() {
    const todos = yield* TodosService
    return yield* todos.create(payload)
  })

export const updateHandler = (id: TodoId, payload: UpdateTodoInput) =>
  Effect.gen(function*() {
    const todos = yield* TodosService
    return yield* todos.update(id, payload)
  })

export const removeHandler = (id: TodoId) =>
  Effect.gen(function*() {
    const todos = yield* TodosService
    return yield* todos.remove(id)
  })

export const TodosApiLive = HttpApiBuilder
  .group(
    DomainApi,
    "todos",
    (handlers) =>
      handlers
        .handle("list", () => listHandler)
        .handle("getById", ({ path }) => getByIdHandler(path.id))
        .handle("create", ({ payload }) => createHandler(payload))
        .handle(
          "update",
          ({ path, payload }) => updateHandler(path.id, payload),
        )
        .handle("remove", ({ path }) => removeHandler(path.id)),
  )
  .pipe(Layer.provide(TodosService.Default))
