import { describe, expect, it, vi } from "vitest"

/**
 * Tests for todo-list.tsx - Todo list component.
 *
 * We test exports. The component itself is tested via visual regression tests.
 */

// Mock @effect/atom-react
vi.mock("@effect/atom-react", () => ({
  useAtomValue: () => ({ waiting: false }),
  useAtomRefresh: () => vi.fn(),
}))

// Mock AsyncResult
vi.mock("effect/unstable/reactivity/AsyncResult", () => ({
  builder: () => ({
    onInitial: vi.fn().mockReturnThis(),
    onSuccess: vi.fn().mockReturnThis(),
    onFailure: vi.fn().mockReturnThis(),
    render: vi.fn(),
  }),
}))

// Mock atoms
vi.mock("./atoms", () => ({
  todosAtom: { _tag: "todosAtom" },
}))

// Mock TodoItem
vi.mock("./todo-item", () => ({
  TodoItem: () => null,
}))

describe("TodoList", () => {
  it("exports TodoList component", async () => {
    const { TodoList } = await import("./todo-list")
    expect(TodoList).toBeDefined()
    expect(typeof TodoList).toBe("function")
  })
})
