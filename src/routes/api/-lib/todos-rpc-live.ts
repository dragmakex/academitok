import { DomainRpc } from "@/api/domain-rpc"
import type {
  CreateTodoInput,
  TodoId,
  UpdateTodoInput,
} from "@/api/todo-schema"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { TodosService } from "./todos-service"

/**
 * RPC handler implementations.
 * These are exported separately for testing.
 */
export const createRpcHandlers = Effect.gen(function*() {
  const todos = yield* TodosService

  // RPC method names must match the schema definition in domain-rpc.ts
  /* eslint-disable camelcase */
  return {
    todos_list: () => todos.list,

    todos_getById: ({ id }: { id: TodoId }) => todos.getById(id),

    todos_create: ({ input }: { input: CreateTodoInput }) =>
      todos.create(input),

    todos_update: ({ id, input }: { id: TodoId; input: UpdateTodoInput }) =>
      todos.update(id, input),

    todos_remove: ({ id }: { id: TodoId }) => todos.remove(id),
  }
  /* eslint-enable camelcase */
})

export const TodosRpcLive = DomainRpc
  .toLayer(createRpcHandlers)
  .pipe(Layer.provide(TodosService.layer))
