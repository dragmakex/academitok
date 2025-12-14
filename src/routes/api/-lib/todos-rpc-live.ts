import { DomainRpc } from "@/api/domain-rpc"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { TodosService } from "./todos-service"

export const TodosRpcLive = DomainRpc
  .toLayer(
    Effect.gen(function*() {
      const todos = yield* TodosService

      return {
        todosList: () => todos.list,

        todosGetById: ({ id }) => todos.getById(id),

        todosCreate: ({ input }) => todos.create(input),

        todosUpdate: ({ id, input }) => todos.update(id, input),

        todosRemove: ({ id }) => todos.remove(id),
      }
    }),
  )
  .pipe(Layer.provide(TodosService.Default))
