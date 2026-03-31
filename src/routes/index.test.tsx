import { describe, expect, it, vi } from "vitest"

vi.mock("@/routeTree.gen", () => ({}))

vi.mock("effect/Effect", () => ({
  flatMap: vi.fn((service, fn) => ({ _tag: "Effect", service, fn })),
}))

vi.mock("@/lib/atom-utils", () => ({
  dehydrate: vi.fn((remote, result) => ({ remote, result })),
}))

vi.mock("effect/unstable/reactivity/AsyncResult", () => ({
  success: (value: unknown) => ({ _tag: "Success", value }),
}))

vi.mock("@/lib/atom-hydration", () => ({
  HydrationBoundary: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: vi.fn(
    (path: string) => (config: Record<string, unknown>) => ({
      path,
      ...config,
    }),
  ),
  lazyRouteComponent: vi.fn(() => () => null),
}))

vi.mock("@tanstack/react-start", () => ({
  createServerFn: vi.fn(() => ({
    handler: vi.fn((fn) => fn),
  })),
}))

vi.mock("./-index/atoms", () => ({
  todosAtom: {
    remote: { _tag: "TodosRemoteAtom" },
  },
  todoStatsAtom: {
    remote: { _tag: "TodoStatsRemoteAtom" },
  },
  todoGroupsAtom: {
    remote: { _tag: "TodoGroupsRemoteAtom" },
  },
}))

vi.mock("./-index/app", () => ({
  App: () => null,
}))

vi.mock("./api/$", () => ({
  serverRuntime: {
    runPromise: vi.fn().mockResolvedValue({
      todos: [],
      stats: {
        total: 0,
        active: 0,
        completed: 0,
        overdue: 0,
        dueToday: 0,
        upcoming: 0,
        unscheduled: 0,
      },
      groups: [],
    }),
  },
}))

vi.mock("./api/-lib/todos-service", () => ({
  TodosService: {
    _tag: "TodosService",
    asEffect: () => ({ _tag: "TodosServiceEffect" }),
  },
}))

describe("index route", () => {
  it("exports Route", async () => {
    const { Route } = await import("./index")
    expect(Route).toBeDefined()
  })

  it("Route has correct path", async () => {
    const { Route } = await import("./index")
    expect(Route).toHaveProperty("path", "/")
  })

  it("Route has loader and component", async () => {
    const { Route } = await import("./index")
    expect(Route).toHaveProperty("loader")
    expect(Route).toHaveProperty("component")
  })
})
