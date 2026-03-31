import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { CreateTodoForm } from "./create-todo-form"

vi.mock("@effect/atom-react", () => ({
  useAtom: () => [{ waiting: false }, vi.fn()],
}))

vi.mock("./atoms", () => ({
  createTodoAtom: { _tag: "createTodoAtom" },
}))

describe("CreateTodoForm", () => {
  it("exports CreateTodoForm component", () => {
    expect(CreateTodoForm).toBeDefined()
    expect(typeof CreateTodoForm).toBe("function")
  })

  it("renders a semantic form with a submit button", () => {
    const markup = renderToStaticMarkup(<CreateTodoForm />)

    expect(markup).toContain("<form")
    expect(markup).toContain("type=\"submit\"")
    expect(markup).toContain("Task title")
  })
})
