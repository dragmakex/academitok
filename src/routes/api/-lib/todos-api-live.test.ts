// @vitest-environment node

import type { TodoId } from "@/api/todo-schema"
import { makeTodosServiceTestLayer } from "@/db/todos-test-support"
import { expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Option from "effect/Option"
import {
  createHandler,
  getByIdHandler,
  listHandler,
  removeHandler,
  TodosApiLive,
  updateHandler,
} from "./todos-api-live"
import { TodosService } from "./todos-service"

/**
 * Tests for TodosApiLive - the HTTP API layer for todo operations.
 *
 * We test the HTTP handlers by calling them directly with the required context.
 */

it.effect("listHandler - returns empty initially", () =>
  Effect
    .gen(function*() {
      const todos = yield* listHandler
      expect(todos).toEqual([])
    })
    .pipe(Effect.provide(makeTodosServiceTestLayer("empty"))))

it.effect("listHandler - returns seeded rows", () =>
  Effect
    .gen(function*() {
      const todos = yield* listHandler

      expect(todos.map((todo) => todo.title)).toEqual([
        "Alpha todo",
        "Bravo done",
        "Charlie todo",
      ])
      expect(todos[1]?.completed).toBe(true)
    })
    .pipe(Effect.provide(makeTodosServiceTestLayer("mixedState"))))

it.effect("listHandler - returns created todos", () =>
  Effect
    .gen(function*() {
      const service = yield* TodosService
      yield* service.create({ title: "Todo 1" })
      yield* service.create({ title: "Todo 2" })

      const todos = yield* listHandler
      expect(todos).toHaveLength(2)
    })
    .pipe(Effect.provide(makeTodosServiceTestLayer())))

it.effect("createHandler - creates a todo", () =>
  Effect
    .gen(function*() {
      const created = yield* createHandler({ title: "HTTP Todo" })

      expect(created.title).toBe("HTTP Todo")
      expect(created.completed).toBe(false)
      expect(created.id).toBeDefined()
    })
    .pipe(Effect.provide(makeTodosServiceTestLayer())))

it.effect("getByIdHandler - finds a todo", () =>
  Effect
    .gen(function*() {
      const created = yield* createHandler({ title: "Find via HTTP" })

      const found = yield* getByIdHandler(created.id)
      expect(found.id).toBe(created.id)
      expect(found.title).toBe("Find via HTTP")
    })
    .pipe(Effect.provide(makeTodosServiceTestLayer())))

it.effect("getByIdHandler - returns error for missing", () =>
  Effect
    .gen(function*() {
      const fakeId = "non-existent-http-id" as TodoId

      const result = yield* Effect.exit(getByIdHandler(fakeId))
      expect(Exit.isFailure(result)).toBe(true)
    })
    .pipe(Effect.provide(makeTodosServiceTestLayer())))

it.effect("updateHandler - updates a todo", () =>
  Effect
    .gen(function*() {
      const created = yield* createHandler({ title: "Original HTTP" })

      const updated = yield* updateHandler(created.id, {
        title: Option.some("Updated HTTP"),
        completed: Option.some(true),
      })

      expect(updated.title).toBe("Updated HTTP")
      expect(updated.completed).toBe(true)
    })
    .pipe(Effect.provide(makeTodosServiceTestLayer())))

it.effect("removeHandler - removes a todo", () =>
  Effect
    .gen(function*() {
      const created = yield* createHandler({ title: "Delete via HTTP" })

      yield* removeHandler(created.id)

      const todos = yield* listHandler
      expect(todos).toHaveLength(0)
    })
    .pipe(Effect.provide(makeTodosServiceTestLayer())))

it.effect("removeHandler - returns error for missing", () =>
  Effect
    .gen(function*() {
      const fakeId = "non-existent-http-delete" as TodoId

      const result = yield* Effect.exit(removeHandler(fakeId))
      expect(Exit.isFailure(result)).toBe(true)
    })
    .pipe(Effect.provide(makeTodosServiceTestLayer())))

it.effect("TodosApiLive - layer builds successfully", () =>
  Effect.sync(() => {
    expect(TodosApiLive).toBeDefined()
  }))
