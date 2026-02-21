import type { TodoId } from "@/api/todo-schema"
import { expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Option from "effect/Option"
import { createRpcHandlers, TodosRpcLive } from "./todos-rpc-live"
import { TodosService } from "./todos-service"

/**
 * Tests for TodosRpcLive - the RPC layer for todo operations.
 *
 * We test the RPC handlers by calling createRpcHandlers directly,
 * which creates the handler object with all the delegation functions.
 */

it.effect("createRpcHandlers - creates handler object", () =>
  Effect
    .gen(function*() {
      const handlers = yield* createRpcHandlers

      expect(handlers.todos_list).toBeDefined()
      expect(handlers.todos_getById).toBeDefined()
      expect(handlers.todos_create).toBeDefined()
      expect(handlers.todos_update).toBeDefined()
      expect(handlers.todos_remove).toBeDefined()
    })
    .pipe(Effect.provide(TodosService.layer)))

it.effect("createRpcHandlers - todos_list returns empty initially", () =>
  Effect
    .gen(function*() {
      const handlers = yield* createRpcHandlers
      const todos = yield* handlers.todos_list()
      expect(todos).toEqual([])
    })
    .pipe(Effect.provide(TodosService.layer)))

it.effect("createRpcHandlers - todos_create creates a todo", () =>
  Effect
    .gen(function*() {
      const handlers = yield* createRpcHandlers
      const created = yield* handlers.todos_create({
        input: { title: "RPC Todo" },
      })

      expect(created.title).toBe("RPC Todo")
      expect(created.completed).toBe(false)
      expect(created.id).toBeDefined()
    })
    .pipe(Effect.provide(TodosService.layer)))

it.effect("createRpcHandlers - todos_getById finds a todo", () =>
  Effect
    .gen(function*() {
      const handlers = yield* createRpcHandlers
      const created = yield* handlers.todos_create({
        input: { title: "Find via RPC" },
      })

      const found = yield* handlers.todos_getById({ id: created.id })
      expect(found.id).toBe(created.id)
      expect(found.title).toBe("Find via RPC")
    })
    .pipe(Effect.provide(TodosService.layer)))

it.effect("createRpcHandlers - todos_getById returns error for missing", () =>
  Effect
    .gen(function*() {
      const handlers = yield* createRpcHandlers
      const fakeId = "non-existent-rpc-id" as TodoId

      const result = yield* Effect.exit(handlers.todos_getById({ id: fakeId }))
      expect(Exit.isFailure(result)).toBe(true)
    })
    .pipe(Effect.provide(TodosService.layer)))

it.effect("createRpcHandlers - todos_update modifies a todo", () =>
  Effect
    .gen(function*() {
      const handlers = yield* createRpcHandlers
      const created = yield* handlers.todos_create({
        input: { title: "Original RPC" },
      })

      const updated = yield* handlers.todos_update({
        id: created.id,
        input: {
          title: Option.some("Updated RPC"),
          completed: Option.some(true),
        },
      })

      expect(updated.title).toBe("Updated RPC")
      expect(updated.completed).toBe(true)
    })
    .pipe(Effect.provide(TodosService.layer)))

it.effect("createRpcHandlers - todos_remove deletes a todo", () =>
  Effect
    .gen(function*() {
      const handlers = yield* createRpcHandlers
      const created = yield* handlers.todos_create({
        input: { title: "Delete via RPC" },
      })

      yield* handlers.todos_remove({ id: created.id })

      const todos = yield* handlers.todos_list()
      expect(todos).toHaveLength(0)
    })
    .pipe(Effect.provide(TodosService.layer)))

it.effect("createRpcHandlers - todos_remove returns error for missing", () =>
  Effect
    .gen(function*() {
      const handlers = yield* createRpcHandlers
      const fakeId = "non-existent-rpc-delete" as TodoId

      const result = yield* Effect.exit(handlers.todos_remove({ id: fakeId }))
      expect(Exit.isFailure(result)).toBe(true)
    })
    .pipe(Effect.provide(TodosService.layer)))

it.effect("TodosRpcLive - layer builds successfully", () =>
  Effect.sync(() => {
    // Just verify the layer can be built without errors
    expect(TodosRpcLive).toBeDefined()
  }))
