import type {
  CreateTodoInput,
  Todo,
  TodoId,
  TodoNotFound,
  UpdateTodoInput,
} from "@/api/todo-schema"
import { type TodoSeed, TodosRepository } from "@/db/todos-repository"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as ServiceMap from "effect/ServiceMap"

export class TodosService extends ServiceMap.Service<TodosService>()(
  "TodosService",
  {
    make: Effect.gen(function*() {
      const repository = yield* TodosRepository

      return {
        list: repository.list,
        getById: (id: TodoId): Effect.Effect<Todo, TodoNotFound> =>
          repository.getById(id),
        create: (input: CreateTodoInput): Effect.Effect<Todo> =>
          repository.create(input),
        update: (
          id: TodoId,
          input: UpdateTodoInput,
        ): Effect.Effect<Todo, TodoNotFound> => repository.update(id, input),
        remove: (id: TodoId): Effect.Effect<void, TodoNotFound> =>
          repository.remove(id),
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
