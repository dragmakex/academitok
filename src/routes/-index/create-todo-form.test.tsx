import { describe, expect, it, vi } from "vitest"

/**
 * Tests for create-todo-form.tsx - Form for creating new todos.
 *
 * We test exports. The component itself is tested via visual regression tests.
 */

// Mock @effect-atom/atom-react
vi.mock("@effect-atom/atom-react", () => ({
  Result: {
    initial: () => ({ waiting: false }),
    success: (value: unknown) => ({ value, _tag: "Success" }),
    failure: () => ({ _tag: "Failure" }),
    isSuccess: (r: { _tag?: string }) => r._tag === "Success",
    isFailure: (r: { _tag?: string }) => r._tag === "Failure",
  },
  useAtom: () => [{ waiting: false }, vi.fn()],
}))

// Mock atoms
vi.mock("./atoms", () => ({
  createTodoAtom: { _tag: "createTodoAtom" },
}))

describe("CreateTodoForm", () => {
  it("exports CreateTodoForm component", async () => {
    const { CreateTodoForm } = await import("./create-todo-form")
    expect(CreateTodoForm).toBeDefined()
    expect(typeof CreateTodoForm).toBe("function")
  })

  it("CreateTodoForm is a React functional component", async () => {
    const { CreateTodoForm } = await import("./create-todo-form")
    // Functional components have no required props
    expect(CreateTodoForm.length).toBe(0)
  })
})
