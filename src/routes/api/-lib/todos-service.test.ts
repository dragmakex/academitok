import { TodoId, TodoNotFound } from "@/api/todo-schema"
import { expect, it } from "@effect/vitest"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { TodosService } from "./todos-service"

/**
 * Tests for TodosService - the core business logic for todo management.
 *
 * These tests verify all CRUD operations and error handling.
 */

it.effect("list returns empty array initially", () =>
  Effect
    .gen(function*() {
      const service = yield* TodosService
      const todos = yield* service.list
      expect(todos).toEqual([])
    })
    .pipe(Effect.provide(TodosService.layer)))

it.effect("create adds a new todo", () =>
  Effect
    .gen(function*() {
      const service = yield* TodosService
      const created = yield* service.create({ title: "Test todo" })

      expect(created.title).toBe("Test todo")
      expect(created.completed).toBe(false)
      expect(created.id).toBeDefined()
      expect(created.createdAt).toBeDefined()

      const todos = yield* service.list
      expect(todos).toHaveLength(1)
      expect(todos[0]).toEqual(created)
    })
    .pipe(Effect.provide(TodosService.layer)))

it.effect("getById returns the correct todo", () =>
  Effect
    .gen(function*() {
      const service = yield* TodosService
      const created = yield* service.create({ title: "Find me" })

      const found = yield* service.getById(created.id)
      expect(found).toEqual(created)
    })
    .pipe(Effect.provide(TodosService.layer)))

it.effect("getById fails with TodoNotFound for non-existent id", () =>
  Effect
    .gen(function*() {
      const service = yield* TodosService
      const fakeId = Schema.decodeSync(TodoId)("non-existent-id")

      const result = yield* Effect.exit(service.getById(fakeId))
      expect(Exit.isFailure(result)).toBe(true)

      if (Exit.isFailure(result)) {
        const failReason = result.cause.reasons.find(Cause.isFailReason)
        expect(failReason?.error).toBeInstanceOf(TodoNotFound)
        if (failReason?.error instanceof TodoNotFound) {
          expect(failReason.error.id).toBe(fakeId)
        }
      }
    })
    .pipe(Effect.provide(TodosService.layer)))

it.effect("update modifies todo title", () =>
  Effect
    .gen(function*() {
      const service = yield* TodosService
      const created = yield* service.create({ title: "Original" })

      const updated = yield* service.update(created.id, {
        title: Option.some("Updated"),
        completed: Option.none(),
      })

      expect(updated.id).toBe(created.id)
      expect(updated.title).toBe("Updated")
      expect(updated.completed).toBe(false)
    })
    .pipe(Effect.provide(TodosService.layer)))

it.effect("update modifies todo completed status", () =>
  Effect
    .gen(function*() {
      const service = yield* TodosService
      const created = yield* service.create({ title: "Task" })

      const updated = yield* service.update(created.id, {
        title: Option.none(),
        completed: Option.some(true),
      })

      expect(updated.title).toBe("Task")
      expect(updated.completed).toBe(true)
    })
    .pipe(Effect.provide(TodosService.layer)))

it.effect("update modifies both title and completed", () =>
  Effect
    .gen(function*() {
      const service = yield* TodosService
      const created = yield* service.create({ title: "Original" })

      const updated = yield* service.update(created.id, {
        title: Option.some("New Title"),
        completed: Option.some(true),
      })

      expect(updated.title).toBe("New Title")
      expect(updated.completed).toBe(true)
    })
    .pipe(Effect.provide(TodosService.layer)))

it.effect("update fails with TodoNotFound for non-existent id", () =>
  Effect
    .gen(function*() {
      const service = yield* TodosService
      const fakeId = Schema.decodeSync(TodoId)("non-existent")

      const result = yield* Effect.exit(
        service.update(fakeId, {
          title: Option.some("Test"),
          completed: Option.none(),
        }),
      )

      expect(Exit.isFailure(result)).toBe(true)
    })
    .pipe(Effect.provide(TodosService.layer)))

it.effect("remove deletes a todo", () =>
  Effect
    .gen(function*() {
      const service = yield* TodosService
      const created = yield* service.create({ title: "Delete me" })

      yield* service.remove(created.id)

      const todos = yield* service.list
      expect(todos).toHaveLength(0)
    })
    .pipe(Effect.provide(TodosService.layer)))

it.effect("remove fails with TodoNotFound for non-existent id", () =>
  Effect
    .gen(function*() {
      const service = yield* TodosService
      const fakeId = Schema.decodeSync(TodoId)("non-existent")

      const result = yield* Effect.exit(service.remove(fakeId))
      expect(Exit.isFailure(result)).toBe(true)
    })
    .pipe(Effect.provide(TodosService.layer)))

it.effect("multiple todos are stored correctly", () =>
  Effect
    .gen(function*() {
      const service = yield* TodosService

      const todo1 = yield* service.create({ title: "First" })
      const todo2 = yield* service.create({ title: "Second" })
      const todo3 = yield* service.create({ title: "Third" })

      const todos = yield* service.list
      expect(todos).toHaveLength(3)

      // Verify all todos are present
      const ids = todos.map((t) => t.id)
      expect(ids).toContain(todo1.id)
      expect(ids).toContain(todo2.id)
      expect(ids).toContain(todo3.id)
    })
    .pipe(Effect.provide(TodosService.layer)))

it.effect("each todo gets a unique id", () =>
  Effect
    .gen(function*() {
      const service = yield* TodosService

      const todo1 = yield* service.create({ title: "First" })
      const todo2 = yield* service.create({ title: "Second" })

      expect(todo1.id).not.toBe(todo2.id)
    })
    .pipe(Effect.provide(TodosService.layer)))
