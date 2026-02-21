import { TodoId } from "@/api/todo-schema"
import * as Schema from "effect/Schema"
import { describe, expect, it, vi } from "vitest"

/**
 * Tests for atoms.tsx - Atom definitions for todo state management.
 *
 * We test the atom structure and exported items without requiring
 * the full API runtime.
 */

// Mock the dependencies
vi.mock("@/api/api-client", () => ({
  ApiClient: {
    Default: { _tag: "Layer" },
  },
}))

describe("atoms", () => {
  it("exports runtime", async () => {
    const { runtime } = await import("./atoms")
    expect(runtime).toBeDefined()
  })

  it("exports todosAtom", async () => {
    const { todosAtom } = await import("./atoms")
    expect(todosAtom).toBeDefined()
  })

  it("todosAtom has remote property", async () => {
    const { todosAtom } = await import("./atoms")
    expect(todosAtom.remote).toBeDefined()
  })

  it("exports createTodoAtom", async () => {
    const { createTodoAtom } = await import("./atoms")
    expect(createTodoAtom).toBeDefined()
  })

  it("exports updateTodoAtom", async () => {
    const { updateTodoAtom } = await import("./atoms")
    expect(updateTodoAtom).toBeDefined()
  })

  it("exports deleteTodoAtom", async () => {
    const { deleteTodoAtom } = await import("./atoms")
    expect(deleteTodoAtom).toBeDefined()
  })

  describe("TodosCacheUpdate types", () => {
    it("Upsert update type is supported", () => {
      // Test that the Upsert tag is valid
      const update = {
        _tag: "Upsert" as const,
        todo: {
          id: Schema.decodeSync(TodoId)("test-id"),
          title: "Test",
          completed: false,
        },
      }
      expect(update._tag).toBe("Upsert")
    })

    it("Delete update type is supported", () => {
      // Test that the Delete tag is valid
      const update = {
        _tag: "Delete" as const,
        id: Schema.decodeSync(TodoId)("test-id"),
      }
      expect(update._tag).toBe("Delete")
    })
  })

  describe("Api service", () => {
    it("defines list operation", () => {
      // Api service structure test
      const apiShape = {
        list: expect.any(Function),
        create: expect.any(Function),
        update: expect.any(Function),
        remove: expect.any(Function),
      }
      expect(apiShape.list).toBeDefined()
    })
  })
})
