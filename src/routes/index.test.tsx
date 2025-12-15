import { describe, expect, it, vi } from "vitest"

/**
 * Tests for index.tsx - Main index route.
 *
 * We test basic exports.
 */

// Mock the routeTree.gen to prevent TanStack router imports
vi.mock("@/routeTree.gen", () => ({}))

// Mock Effect
vi.mock("effect/Effect", () => ({
  flatMap: vi.fn((service, fn) => ({ _tag: "Effect", service, fn })),
}))

// Mock atom-utils
vi.mock("@/lib/atom-utils", () => ({
  dehydrate: vi.fn((remote, result) => ({ remote, result })),
}))

// Mock @effect-atom/atom-react
vi.mock("@effect-atom/atom-react", () => ({
  Result: {
    initial: () => ({ waiting: false }),
    success: (value: unknown) => ({ value, _tag: "Success" }),
    failure: () => ({ _tag: "Failure" }),
    fromExit: (exit: unknown) => exit,
    isSuccess: (r: { _tag?: string }) => r._tag === "Success",
    isFailure: (r: { _tag?: string }) => r._tag === "Failure",
  },
}))

// Mock ReactHydration
vi.mock("@effect-atom/atom-react/ReactHydration", () => ({
  HydrationBoundary: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock TanStack router completely
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: vi.fn(
    (path: string) => (config: Record<string, unknown>) => ({
      path,
      ...config,
    }),
  ),
  lazyRouteComponent: vi.fn(() => () => null),
}))

// Mock TanStack start
vi.mock("@tanstack/react-start", () => ({
  createServerFn: vi.fn(() => ({
    handler: vi.fn((fn) => fn),
  })),
}))

// Mock atoms
vi.mock("./-index/atoms", () => ({
  todosAtom: {
    remote: { _tag: "RemoteAtom" },
  },
}))

// Mock App component
vi.mock("./-index/app", () => ({
  App: () => null,
}))

// Mock server runtime
vi.mock("./api/$", () => ({
  serverRuntime: {
    runPromiseExit: vi.fn().mockResolvedValue({ _tag: "Success", value: [] }),
  },
}))

// Mock TodosService
vi.mock("./api/-lib/todos-service", () => ({
  TodosService: { _tag: "TodosService" },
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

  it("Route has loader function", async () => {
    const { Route } = await import("./index")
    expect(Route).toHaveProperty("loader")
  })

  it("Route has component function", async () => {
    const { Route } = await import("./index")
    expect(Route).toHaveProperty("component")
  })
})
