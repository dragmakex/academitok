import * as Schema from "effect/Schema"
export const TodoId = Schema.String.pipe(Schema.brand("TodoId"))
export type TodoId = typeof TodoId.Type

export const Todo = Schema.Struct({
  id: TodoId,
  title: Schema.String,
  completed: Schema.Boolean,
  createdAt: Schema.DateTimeUtc,
})
export type Todo = typeof Todo.Type

export const CreateTodoInput = Schema.Struct({
  title: Schema.NonEmptyString,
})
export type CreateTodoInput = typeof CreateTodoInput.Type

export const UpdateTodoInput = Schema.Struct({
  title: Schema.OptionFromOptionalKey(Schema.NonEmptyString),
  completed: Schema.OptionFromOptionalKey(Schema.Boolean),
})
export type UpdateTodoInput = typeof UpdateTodoInput.Type

export class TodoNotFound extends Schema.TaggedErrorClass<TodoNotFound>()(
  "TodoNotFound",
  {
    id: TodoId,
  },
  { httpApiStatus: 404 },
) {}
