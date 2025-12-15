import { describe, expect, it, vi } from "vitest"

/**
 * Tests for app.tsx - Main application component.
 *
 * We test exports and structure without calling the component directly
 * since it depends on child components with hooks.
 */

// Mock child components to avoid complex dependencies
vi.mock("./create-todo-form", () => ({
  CreateTodoForm: () => null,
}))

vi.mock("./todo-list", () => ({
  TodoList: () => null,
}))

describe("App", () => {
  it("exports App component", async () => {
    const { App } = await import("./app")
    expect(App).toBeDefined()
    expect(typeof App).toBe("function")
  })

  it("App is a React functional component", async () => {
    const { App } = await import("./app")
    // Functional components have no required props
    expect(App.length).toBe(0)
  })
})
