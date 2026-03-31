// @vitest-environment node

import { TodoId } from "@/api/todo-schema"
import { makeTodosServiceTestLayer } from "@/db/todos-test-support"
import { expect, it } from "@effect/vitest"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { todayDate, TodosService } from "./todos-service"

const addUtcDays = (date: string, days: number): string => {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

it.effect("list returns empty array initially", () =>
  Effect
    .gen(function*() {
      const service = yield* TodosService
      const todos = yield* service.list
      expect(todos).toEqual([])
    })
    .pipe(Effect.provide(makeTodosServiceTestLayer("empty"))))

it.effect("list preserves deterministic seeded order", () =>
  Effect
    .gen(function*() {
      const service = yield* TodosService
      const todos = yield* service.list

      expect(todos.map((todo) => todo.title)).toEqual([
        "Alpha todo",
        "Charlie todo",
        "Bravo done",
      ])
    })
    .pipe(Effect.provide(makeTodosServiceTestLayer("mixedState"))))

it.effect("create returns a snapshot with unscheduled work when no due date is set", () =>
  Effect
    .gen(function*() {
      const service = yield* TodosService
      const snapshot = yield* service.create({
        title: "Restore dashboard",
        dueDate: null,
      })

      expect(snapshot.todos).toHaveLength(1)
      expect(snapshot.todos[0]?.title).toBe("Restore dashboard")
      expect(snapshot.stats).toMatchObject({
        total: 1,
        active: 1,
        completed: 0,
        overdue: 0,
        dueToday: 0,
        upcoming: 0,
        unscheduled: 1,
      })
      expect(snapshot.groups.map((group) => [group.key, group.count])).toEqual([
        ["overdue", 0],
        ["today", 0],
        ["upcoming", 0],
        ["unscheduled", 1],
        ["completed", 0],
      ])
    })
    .pipe(Effect.provide(makeTodosServiceTestLayer())))

it.effect("snapshot classification keeps stats and groups aligned", () =>
  Effect
    .gen(function*() {
      const service = yield* TodosService
      const today = todayDate()

      yield* service.create({
        title: "Overdue task",
        dueDate: addUtcDays(today, -1),
      })
      yield* service.create({
        title: "Today task",
        dueDate: today,
      })
      yield* service.create({
        title: "Upcoming task",
        dueDate: addUtcDays(today, 2),
      })
      yield* service.create({
        title: "Unscheduled task",
        dueDate: null,
      })
      const completedSnapshot = yield* service.create({
        title: "Completed task",
        dueDate: addUtcDays(today, 4),
      })
      const completedTodo = completedSnapshot.todos.find((todo) =>
        todo.title === "Completed task"
      )

      if (completedTodo === undefined) {
        return yield* Effect.die(new Error("Expected completed todo to exist"))
      }

      yield* service.update(completedTodo.id, {
        title: Option.none(),
        completed: Option.some(true),
        dueDate: Option.none(),
      })

      const snapshot = yield* service.snapshot
      const counts = Object.fromEntries(
        snapshot.groups.map((group) => [group.key, group.count]),
      )

      expect(snapshot.stats.total).toBe(5)
      expect(snapshot.stats.active).toBe(4)
      expect(snapshot.stats.completed).toBe(counts.completed)
      expect(snapshot.stats.overdue).toBe(counts.overdue)
      expect(snapshot.stats.dueToday).toBe(counts.today)
      expect(snapshot.stats.upcoming).toBe(counts.upcoming)
      expect(snapshot.stats.unscheduled).toBe(counts.unscheduled)
      expect(snapshot.groups.flatMap((group) => group.todos)).toHaveLength(5)
    })
    .pipe(Effect.provide(makeTodosServiceTestLayer())))

it.effect("update modifies title, due date, and completion inside the returned snapshot", () =>
  Effect
    .gen(function*() {
      const service = yield* TodosService
      const created = yield* service.create({
        title: "Original",
        dueDate: null,
      })
      const todo = created.todos[0]

      if (todo === undefined) {
        return yield* Effect.die(new Error("Expected created todo"))
      }

      const updated = yield* service.update(todo.id, {
        title: Option.some("Updated"),
        completed: Option.some(true),
        dueDate: Option.some(todayDate()),
      })
      const updatedTodo = updated.todos.find((item) => item.id === todo.id)

      expect(updatedTodo).toMatchObject({
        title: "Updated",
        completed: true,
        dueDate: todayDate(),
      })
      expect(updated.stats).toMatchObject({
        completed: 1,
        active: 0,
      })
    })
    .pipe(Effect.provide(makeTodosServiceTestLayer())))

it.effect("remove returns the remaining snapshot", () =>
  Effect
    .gen(function*() {
      const service = yield* TodosService
      const first = yield* service.create({ title: "First", dueDate: null })
      const second = yield* service.create({ title: "Second", dueDate: null })
      const firstTodo = first.todos[0]
      const secondTodo = second.todos.find((todo) => todo.title === "Second")

      if (firstTodo === undefined || secondTodo === undefined) {
        return yield* Effect.die(new Error("Expected created todos"))
      }

      const snapshot = yield* service.remove(firstTodo.id)

      expect(snapshot.todos).toHaveLength(1)
      expect(snapshot.todos[0]?.id).toBe(secondTodo.id)
      expect(snapshot.stats.total).toBe(1)
    })
    .pipe(Effect.provide(makeTodosServiceTestLayer())))

it.effect("getById fails with TodoNotFound for non-existent id", () =>
  Effect
    .gen(function*() {
      const service = yield* TodosService
      const fakeId = Schema.decodeSync(TodoId)("non-existent-id")

      const result = yield* Effect.exit(service.getById(fakeId))
      expect(Exit.isFailure(result)).toBe(true)

      if (Exit.isFailure(result)) {
        const failReason = result.cause.reasons.find(Cause.isFailReason)
        expect(failReason?.error).toMatchObject({
          _tag: "TodoNotFound",
          id: fakeId,
        })
      }
    })
    .pipe(Effect.provide(makeTodosServiceTestLayer())))
