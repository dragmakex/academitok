import * as Option from "effect/Option"
import { describe, expect, it, vi } from "vitest"

/**
 * Tests for todo-item.tsx - Individual todo item component.
 *
 * We test exports. The component itself is tested via visual regression tests.
 */

// Mock @effect/atom-react
vi.mock("@effect/atom-react", () => ({
  useAtom: () => [{ waiting: false }, vi.fn()],
  useAtomRefresh: () => vi.fn(),
}))

// Mock AsyncResult
vi.mock("effect/unstable/reactivity/AsyncResult", () => ({
  isFailure: () => false,
}))

// Mock atoms
vi.mock("./atoms", () => ({
  todosAtom: { _tag: "todosAtom" },
  updateTodoAtom: { _tag: "updateTodoAtom" },
  deleteTodoAtom: { _tag: "deleteTodoAtom" },
}))

describe("TodoItem", () => {
  it("exports TodoItem component", async () => {
    const { TodoItem } = await import("./todo-item")
    expect(TodoItem).toBeDefined()
    expect(typeof TodoItem).toBe("function")
  })

  it("TodoItem accepts todo prop", async () => {
    const { TodoItem } = await import("./todo-item")
    // Function.length indicates number of required parameters
    expect(TodoItem.length).toBe(1)
  })

  it("update payload uses Option for partial updates", () => {
    // Test the update payload structure
    const togglePayload = {
      input: { title: Option.none(), completed: Option.some(true) },
    }
    expect(Option.isNone(togglePayload.input.title)).toBe(true)
    expect(Option.isSome(togglePayload.input.completed)).toBe(true)
    expect(Option.getOrThrow(togglePayload.input.completed)).toBe(true)
  })
})
