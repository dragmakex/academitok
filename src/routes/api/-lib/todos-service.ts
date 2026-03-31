import type {
  CreateTodoInput,
  Todo,
  TodoDashboardSnapshot,
  TodoDate,
  TodoGroup,
  TodoGroupKey,
  TodoId,
  TodoNotFound,
  TodoStats,
  UpdateTodoInput,
} from "@/api/todo-schema"
import { type TodoSeed, TodosRepository } from "@/db/todos-repository"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as ServiceMap from "effect/ServiceMap"

const compareTodoDates = (
  left: TodoDate | null,
  right: TodoDate | null,
): number => {
  if (left === right) {
    return 0
  }
  if (left === null) {
    return 1
  }
  if (right === null) {
    return -1
  }
  return left.localeCompare(right)
}

const compareTodos = (left: Todo, right: Todo): number => {
  const completedOrder = Number(left.completed) - Number(right.completed)
  if (completedOrder !== 0) {
    return completedOrder
  }

  const dueDateOrder = compareTodoDates(left.dueDate, right.dueDate)
  if (dueDateOrder !== 0) {
    return dueDateOrder
  }

  if (left.updatedAt.epochMillis !== right.updatedAt.epochMillis) {
    return left.updatedAt.epochMillis - right.updatedAt.epochMillis
  }

  return left.id.localeCompare(right.id)
}

/**
 * Produces the current UTC day in the todo date format.
 *
 * @returns The current UTC date string.
 */
export function todayDate(): TodoDate {
  const now = new Date()
  const yyyy = String(now.getUTCFullYear())
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(now.getUTCDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

const classifyTodo = (
  todo: Todo,
  today: TodoDate,
): TodoGroupKey => {
  if (todo.completed) {
    return "completed"
  }

  if (todo.dueDate === null) {
    return "unscheduled"
  }

  if (todo.dueDate < today) {
    return "overdue"
  }

  if (todo.dueDate === today) {
    return "today"
  }

  return "upcoming"
}

const makeStats = (todos: ReadonlyArray<Todo>): TodoStats => {
  const today = todayDate()

  return todos.reduce<TodoStats>(
    (stats, todo) => {
      const classification = classifyTodo(todo, today)

      return {
        total: stats.total + 1,
        active: stats.active + (todo.completed ? 0 : 1),
        completed: stats.completed + (classification === "completed" ? 1 : 0),
        overdue: stats.overdue + (classification === "overdue" ? 1 : 0),
        dueToday: stats.dueToday + (classification === "today" ? 1 : 0),
        upcoming: stats.upcoming + (classification === "upcoming" ? 1 : 0),
        unscheduled: stats.unscheduled
          + (classification === "unscheduled" ? 1 : 0),
      }
    },
    {
      total: 0,
      active: 0,
      completed: 0,
      overdue: 0,
      dueToday: 0,
      upcoming: 0,
      unscheduled: 0,
    },
  )
}

const makeGroups = (todos: ReadonlyArray<Todo>): ReadonlyArray<TodoGroup> => {
  const today = todayDate()
  const buckets: Record<TodoGroupKey, Array<Todo>> = {
    overdue: [],
    today: [],
    upcoming: [],
    unscheduled: [],
    completed: [],
  }

  for (const todo of [...todos].sort(compareTodos)) {
    buckets[classifyTodo(todo, today)].push(todo)
  }

  const definitions: ReadonlyArray<{
    readonly key: TodoGroupKey
    readonly label: string
  }> = [
    { key: "overdue", label: "Overdue" },
    { key: "today", label: "Due today" },
    { key: "upcoming", label: "Upcoming" },
    { key: "unscheduled", label: "Unscheduled" },
    { key: "completed", label: "Completed" },
  ]

  return definitions.map(({ key, label }) => ({
    key,
    label,
    count: buckets[key].length,
    todos: buckets[key],
  }))
}

const makeSnapshot = (todos: ReadonlyArray<Todo>): TodoDashboardSnapshot => {
  const orderedTodos = [...todos].sort(compareTodos)
  return {
    todos: orderedTodos,
    stats: makeStats(orderedTodos),
    groups: makeGroups(orderedTodos),
  }
}

export class TodosService extends ServiceMap.Service<TodosService>()(
  "TodosService",
  {
    make: Effect.gen(function*() {
      const repository = yield* TodosRepository

      const snapshot = repository.list.pipe(
        Effect.map(makeSnapshot),
        Effect.withSpan("TodosService.snapshot"),
      )

      return {
        list: repository.list.pipe(
          Effect.map((todos) => [...todos].sort(compareTodos)),
          Effect.withSpan("TodosService.list"),
        ),
        stats: snapshot.pipe(
          Effect.map((result) => result.stats),
          Effect.withSpan("TodosService.stats"),
        ),
        groups: snapshot.pipe(
          Effect.map((result) => result.groups),
          Effect.withSpan("TodosService.groups"),
        ),
        snapshot,
        getById: (id: TodoId): Effect.Effect<Todo, TodoNotFound> =>
          repository.getById(id).pipe(
            Effect.withSpan("TodosService.getById", {
              attributes: { "todo.id": id },
            }),
          ),
        create: (
          input: CreateTodoInput,
        ): Effect.Effect<TodoDashboardSnapshot> =>
          repository.create(input).pipe(
            Effect.flatMap(() => snapshot),
            Effect.withSpan("TodosService.create", {
              attributes: {
                "todo.has_due_date": input.dueDate === null ? "false" : "true",
                "todo.title": input.title,
              },
            }),
          ),
        update: (
          id: TodoId,
          input: UpdateTodoInput,
        ): Effect.Effect<TodoDashboardSnapshot, TodoNotFound> =>
          repository.update(id, input).pipe(
            Effect.flatMap(() => snapshot),
            Effect.withSpan("TodosService.update", {
              attributes: { "todo.id": id },
            }),
          ),
        remove: (
          id: TodoId,
        ): Effect.Effect<TodoDashboardSnapshot, TodoNotFound> =>
          repository.remove(id).pipe(
            Effect.flatMap(() => snapshot),
            Effect.withSpan("TodosService.remove", {
              attributes: { "todo.id": id },
            }),
          ),
      } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(TodosRepository.layer),
  )

  static readonly testLayer = Layer.effect(this, this.make).pipe(
    Layer.provide(TodosRepository.testLayer),
  )

  /**
   * Creates a service layer backed by an in-memory seeded PGlite repository.
   *
   * @param seed - The deterministic rows to preload before the test runs.
   * @returns A todo service layer for invariant-style tests.
   */
  static layerFromSeed(seed: TodoSeed): Layer.Layer<TodosService> {
    return Layer.effect(this, this.make).pipe(
      Layer.provide(TodosRepository.layerFromSeed(seed)),
    )
  }
}
