import { curatedPapers } from "@/data/papers"
import { describe, expect, it, vi } from "vitest"

/**
 * Route head entries for the three surfaces: deck, morgue and permalink.
 * Router and server modules are mocked the way `__root.test.tsx` mocks them.
 */

vi.mock("../styles.css?url", () => ({ default: "/styles.css" }))

vi.mock("@effect/atom-react", () => ({
  RegistryProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@tanstack/react-devtools", () => ({ TanStackDevtools: () => null }))

vi.mock("@tanstack/react-router", () => ({
  createRootRoute: vi.fn((config) => config),
  createFileRoute: vi.fn(
    (path: string) => (config: Record<string, unknown>) => ({
      path,
      ...config,
    }),
  ),
  HeadContent: () => null,
  Scripts: () => null,
  lazyRouteComponent: vi.fn(() => () => null),
  notFound: vi.fn(() => new Error("not found")),
}))

vi.mock("@tanstack/react-router-devtools", () => ({
  TanStackRouterDevtoolsPanel: () => null,
}))

vi.mock("@tanstack/react-start", () => {
  const chain = {
    handler: <T,>(fn: T) => fn,
    inputValidator: () => chain,
  }
  return { createServerFn: vi.fn(() => chain) }
})

vi.mock("@/lib/atom-hydration", () => ({
  HydrationBoundary: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock("@/lib/atom-utils", () => ({ dehydrate: vi.fn() }))

vi.mock("effect/unstable/reactivity/AsyncResult", () => ({
  success: (value: unknown) => ({ _tag: "Success", value }),
}))

vi.mock("./-index/atoms", () => ({
  dashboardSnapshotAtom: { remote: { _tag: "DashboardSnapshotRemoteAtom" } },
  savedPageAtom: { remote: { _tag: "SavedPageRemoteAtom" } },
}))

vi.mock("./-index/app", () => ({ App: () => null }))

vi.mock("./-saved/saved", () => ({ SavedPage: () => null }))

vi.mock("./api/$", () => ({ serverRuntime: { runPromise: vi.fn() } }))

vi.mock("@/features/papers/application", () => ({
  getPaperFeedSnapshot: vi.fn(),
  getSavedPapers: vi.fn(),
  getPaperById: vi.fn(),
  getPaperAudience: vi.fn(),
}))

describe("route heads", () => {
  it("names the deck and describes it", async () => {
    const { deckHead } = await import("./index")
    const head = deckHead()
    const title = head.meta.find((entry) => "title" in entry)

    expect(title).toEqual({ title: "AcademiTok — the reading deck" })
    expect(head.meta).toContainEqual({
      name: "description",
      content:
        "A full-screen reading deck of open-access papers, set like a broadsheet and tuned by what you read.",
    })
  })

  it("names the morgue and describes it", async () => {
    const { morgueHead } = await import("./saved")
    const head = morgueHead()

    expect(head.meta).toContainEqual({ title: "Clippings · AcademiTok" })
    expect(head.meta).toContainEqual({
      property: "og:title",
      content: "Clippings · AcademiTok",
    })
    expect(
      head.meta.some((entry) =>
        "name" in entry && entry.name === "description"
      ),
    )
      .toBe(true)
  })

  it("names a permalink after its paper and previews the abstract", async () => {
    const { permalinkHead } = await import("./paper/$id")
    const paper = curatedPapers[0]
    if (paper === undefined) {
      throw new Error("missing curated paper fixture")
    }

    const head = permalinkHead(paper)
    const description = head.meta.find((entry) =>
      "name" in entry && entry.name === "description"
    )

    expect(head.meta).toContainEqual({
      title: `${paper.title} · AcademiTok`,
    })
    expect(description).toBeDefined()
    const content = description !== undefined && "content" in description
      ? description.content
      : ""
    expect(content.length).toBeLessThanOrEqual(160)
    expect(paper.abstract.startsWith(content)).toBe(true)
  })

  it("keeps the not-found notice on an unknown permalink", async () => {
    const { permalinkHead } = await import("./paper/$id")

    expect(permalinkHead(undefined).meta).toContainEqual({
      title: "Clipping not found · AcademiTok",
    })
  })

  it("gives no surface the bare gazette title", async () => {
    const [{ deckHead }, { morgueHead }, { permalinkHead }, { rootHead }] =
      await Promise.all([
        import("./index"),
        import("./saved"),
        import("./paper/$id"),
        import("./__root"),
      ])
    const rootTitle = rootHead().meta.find((entry) => "title" in entry)
    const titles = [
      deckHead(),
      morgueHead(),
      permalinkHead(undefined),
    ]
      .flatMap((head) => head.meta.filter((entry) => "title" in entry))

    expect(rootTitle).toEqual({ title: "AcademiTok Gazette" })
    for (const title of titles) {
      expect(title).not.toEqual(rootTitle)
    }
  })
})
