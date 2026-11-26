import { describe, expect, it, vi } from "vitest"

vi.mock("@/routeTree.gen", () => ({}))

vi.mock("@/lib/atom-utils", () => ({
  dehydrate: vi.fn((remote, result, dehydratedAt) => ({
    remote,
    result,
    dehydratedAt,
  })),
}))

vi.mock("effect/reactivity", () => ({
  AsyncResult: {
    success: (value: unknown) => ({ _tag: "Success", value }),
  },
}))

vi.mock("@/lib/atom-hydration", () => ({
  HydrationBoundary: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@tanstack/react-router", () => ({
  createRootRoute: vi.fn((config) => config),
  createFileRoute: vi.fn(
    (path: string) => (config: Record<string, unknown>) => ({
      path,
      ...config,
    }),
  ),
  lazyRouteComponent: vi.fn(() => () => null),
}))

vi.mock("@tanstack/react-start", () => ({
  createServerFn: vi.fn(() => {
    const chain = {
      handler: vi.fn((fn) => fn),
      inputValidator: () => chain,
    }
    return chain
  }),
}))

vi.mock("./-index/atoms", () => ({
  dashboardSnapshotAtom: {
    remote: { _tag: "DashboardSnapshotRemoteAtom" },
  },
}))

vi.mock("./-index/app", () => ({
  App: () => null,
}))

vi.mock("./api/$", () => ({
  serverRuntime: {
    runPromise: vi.fn().mockResolvedValue({
      profile: null,
      selectedTopic: "All",
      selectedSort: "recommended",
      stats: {
        total: 0,
        openAccess: 0,
        institutionAccess: 0,
        liked: 0,
        bookmarked: 0,
      },
      items: [],
      nextCursor: null,
      exploration: 0,
    }),
  },
}))

vi.mock("@/features/papers/application", () => ({
  getPaperFeedSnapshot: vi.fn(() => ({ _tag: "PaperFeedSnapshotEffect" })),
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
