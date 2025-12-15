import { describe, expect, it, vi } from "vitest"

/**
 * Tests for todo-list.tsx - Todo list component.
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
    builder: () => ({
      onInitial: vi.fn().mockReturnThis(),
      onSuccess: vi.fn().mockReturnThis(),
      onFailure: vi.fn().mockReturnThis(),
      render: vi.fn(),
    }),
  },
  useAtomValue: () => ({ waiting: false }),
  useAtomRefresh: () => vi.fn(),
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
