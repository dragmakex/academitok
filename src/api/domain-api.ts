import * as Schema from "effect/Schema"
import * as HttpApi from "effect/unstable/httpapi/HttpApi"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup"
import {
  CreateTodoInput,
  Todo,
  TodoId,
  TodoNotFound,
  UpdateTodoInput,
} from "./todo-schema"

export class TodosApiGroup extends HttpApiGroup
  .make("todos")
  .add(
    HttpApiEndpoint.get("list", "/todos", {
      success: Schema.Array(Todo),
    }),
  )
  .add(
    HttpApiEndpoint.get("getById", "/todos/:id", {
      params: { id: TodoId },
      success: Todo,
      error: TodoNotFound,
    }),
  )
  .add(
    HttpApiEndpoint.post("create", "/todos", {
      payload: CreateTodoInput,
      success: Todo,
    }),
  )
  .add(
    HttpApiEndpoint.patch("update", "/todos/:id", {
      params: { id: TodoId },
      payload: UpdateTodoInput,
      success: Todo,
      error: TodoNotFound,
    }),
  )
  .add(
    HttpApiEndpoint.delete("remove", "/todos/:id", {
      params: { id: TodoId },
      success: Schema.Void,
      error: TodoNotFound,
    }),
  )
{}

export class DomainApi extends HttpApi
  .make("api")
  .add(TodosApiGroup)
  .prefix("/api")
{}
