import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { inflateSync } from "node:zlib"
import { describe, expect, it, vi } from "vitest"

/**
 * Tests for __root.tsx - Root document layout route.
 *
 * We test basic exports.
 */

// Mock the CSS import
vi.mock("../styles.css?url", () => ({
  default: "/styles.css",
}))

// Mock @effect/atom-react
vi.mock("@effect/atom-react", () => ({
  RegistryProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock TanStack devtools
vi.mock("@tanstack/react-devtools", () => ({
  TanStackDevtools: () => null,
}))

// Mock TanStack router
vi.mock("@tanstack/react-router", () => ({
  createRootRoute: vi.fn((config) => config),
  HeadContent: () => null,
  Scripts: () => null,
}))

// Mock TanStack router devtools
vi.mock("@tanstack/react-router-devtools", () => ({
  TanStackRouterDevtoolsPanel: () => null,
}))

describe("__root route", () => {
  it("exports Route", async () => {
    const { Route } = await import("./__root")
    expect(Route).toBeDefined()
  })

  it("Route is configured correctly", async () => {
    const { Route } = await import("./__root")
    // Route is the object returned by createRootRoute
    expect(Route).toHaveProperty("head")
    expect(Route).toHaveProperty("shellComponent")
  })
})

describe("pageHead", () => {
  it("returns one title and one description with their Open Graph twins", async () => {
    const { pageHead } = await import("./__root")
    const head = pageHead({
      title: "Clippings · AcademiTok",
      description: "Saved clippings.",
    })

    expect(head.meta).toEqual([
      { title: "Clippings · AcademiTok" },
      { name: "description", content: "Saved clippings." },
      { property: "og:title", content: "Clippings · AcademiTok" },
      { property: "og:description", content: "Saved clippings." },
    ])
  })

  it("clamps long copy to 160 characters on a word boundary", async () => {
    const { pageHead } = await import("./__root")
    const description = "clippings ".repeat(60).trim()
    const head = pageHead({ title: "Deck", description })
    const summary = head.meta.find((entry) =>
      "name" in entry && entry.name === "description"
    )

    expect(summary).toBeDefined()
    const content = summary !== undefined && "content" in summary
      ? summary.content
      : ""
    expect(content.length).toBeLessThanOrEqual(160)
    expect(content.endsWith("clippings")).toBe(true)
    expect(description.startsWith(content)).toBe(true)
    expect(head.meta).toContainEqual({ property: "og:description", content })
  })

  it("omits a missing description instead of rendering it empty", async () => {
    const { pageHead } = await import("./__root")
    const head = pageHead({ title: "Deck" })

    expect(head.meta).toEqual([
      { title: "Deck" },
      { property: "og:title", content: "Deck" },
    ])
  })
})

describe("gazette shell metadata", () => {
  const manifest = JSON.parse(
    readFileSync(join(process.cwd(), "public/manifest.json"), "utf8"),
  ) as Record<string, unknown>

  it("claims the AcademiTok identity with the paper palette", () => {
    expect(manifest.name).toContain("AcademiTok")
    expect(manifest.short_name).toBe("AcademiTok")
    expect(manifest.start_url).toBe("/")
    expect(manifest.display).toBe("standalone")
    expect(manifest.theme_color).toBe("oklch(0.18 0.012 60)")
    expect(manifest.background_color).toBe("oklch(0.945 0.018 88)")
    expect(JSON.stringify(manifest)).not.toContain("TanStack")
    expect(manifest.icons).toEqual([
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/mark.svg", sizes: "any", type: "image/svg+xml" },
    ])
    expect(manifest.scope).toBe("/")
    expect(manifest.display).toBe("standalone")
  })

  it("ships a service worker that never replays an rpc", () => {
    const worker = readFileSync(join(process.cwd(), "public/sw.js"), "utf8")
    expect(worker).toContain("/newsprint.webp")
    expect(worker).toContain("startsWith(\"/api/\")")
    expect(worker).toContain("request.mode === \"navigate\"")
  })

  it("links the manifest from the root head", async () => {
    const { rootHead } = await import("./__root")
    const head = rootHead()
    expect(head.links).toContainEqual({
      rel: "manifest",
      href: "/manifest.json",
    })
    expect(head.links).toContainEqual({
      rel: "icon",
      href: "/mark.svg",
      type: "image/svg+xml",
    })
    expect(head.meta).toContainEqual({
      name: "theme-color",
      content: manifest.theme_color,
    })
  })

  it("opts the installed iOS shell out of Safari chrome", async () => {
    const { rootHead } = await import("./__root")
    const meta = rootHead().meta ?? []
    const appleMeta = (name: string) =>
      meta.filter((entry) => "name" in entry && entry.name === name)

    expect(appleMeta("apple-mobile-web-app-capable")).toEqual([
      { name: "apple-mobile-web-app-capable", content: "yes" },
    ])
    expect(appleMeta("apple-mobile-web-app-status-bar-style")).toEqual([
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black-translucent",
      },
    ])
    expect(appleMeta("apple-mobile-web-app-title")).toEqual([
      { name: "apple-mobile-web-app-title", content: manifest.short_name },
    ])
    expect(meta).toContainEqual({
      name: "viewport",
      content: "width=device-width, initial-scale=1, viewport-fit=cover",
    })
    expect(meta).toContainEqual({
      name: "theme-color",
      content: manifest.theme_color,
    })
  })

  it("serves a hand-drawn gazette mark and retires the sample assets", () => {
    const markPath = join(process.cwd(), "public/mark.svg")
    expect(existsSync(markPath)).toBe(true)
    const mark = readFileSync(markPath, "utf8")
    expect(mark).toContain("<svg")
    expect(mark).toContain("oklch(0.18 0.012 60)")
    expect(mark).toContain("oklch(0.972 0.014 92)")
    // Ink on paper only: the sample mark's red accent was retired with the palette.
    expect(mark).not.toContain("oklch(0.52 0.19 28)")
    for (
      const asset of [
        "favicon.ico",
        "tanstack-circle-logo.png",
        "tanstack-word-logo-white.svg",
      ]
    ) {
      expect(existsSync(join(process.cwd(), "public", asset))).toBe(false)
    }
  })

  it("links a rasterised 180px home-screen icon iOS can draw", async () => {
    const { rootHead } = await import("./__root")
    const touchIcons = (rootHead().links ?? []).filter((link) =>
      link.rel === "apple-touch-icon"
    )

    expect(touchIcons).toEqual([
      {
        rel: "apple-touch-icon",
        href: "/apple-touch-icon.png",
        sizes: "180x180",
      },
    ])
  })

  it("ships an opaque 180x180 PNG the mark was rasterised into", () => {
    const png = readFileSync(join(process.cwd(), "public/apple-touch-icon.png"))
    expect([...png.subarray(0, 8)]).toEqual([
      0x89,
      0x50,
      0x4e,
      0x47,
      0x0d,
      0x0a,
      0x1a,
      0x0a,
    ])

    let offset = 8
    const data: Array<Buffer> = []
    let header: Buffer | undefined
    while (offset < png.length) {
      const length = png.readUInt32BE(offset)
      const type = png.toString("ascii", offset + 4, offset + 8)
      const body = png.subarray(offset + 8, offset + 8 + length)
      if (type === "IHDR") {
        header = body
      }
      if (type === "IDAT") {
        data.push(body)
      }
      offset += 12 + length
    }

    expect(header).toBeDefined()
    const width = header?.readUInt32BE(0) ?? 0
    const height = header?.readUInt32BE(4) ?? 0
    expect([width, height]).toEqual([180, 180])
    expect(header?.[8]).toBe(8)
    // Truecolour without an alpha channel, so no pixel can come out transparent.
    expect(header?.[9]).toBe(2)

    const raster = inflateSync(Buffer.concat(data))
    const row = width * 3 + 1
    expect(raster.length).toBe(height * row)
    // Undo the per-row filters: rsvg writes Sub/Up/Paeth, not raw rows.
    const flat = Buffer.alloc(height * row)
    for (let y = 0; y < height; y++) {
      const filter = raster[y * row] ?? 0
      for (let x = 0; x < row - 1; x++) {
        const raw = raster[y * row + 1 + x] ?? 0
        const left = x >= 3 ? flat[y * row + 1 + x - 3] ?? 0 : 0
        const up = y > 0 ? flat[(y - 1) * row + 1 + x] ?? 0 : 0
        const upLeft = y > 0 && x >= 3
          ? flat[(y - 1) * row + 1 + x - 3] ?? 0
          : 0
        const paeth = [left, up, upLeft].reduce((best, candidate) =>
          Math.abs(candidate - (left + up - upLeft))
              < Math.abs(best - (left + up - upLeft))
            ? candidate
            : best
        )
        const value = filter === 0
          ? raw
          : filter === 1
          ? raw + left
          : filter === 2
          ? raw + up
          : filter === 3
          ? raw + Math.floor((left + up) / 2)
          : raw + paeth
        flat[y * row + 1 + x] = value % 256
      }
    }
    const pixel = (x: number, y: number) => {
      const at = y * row + 1 + x * 3
      return [...flat.subarray(at, at + 3)]
    }
    // The ink ground is full-bleed: every corner is ink, not padding.
    expect(pixel(0, 0)).toEqual([22, 16, 12])
    expect(pixel(width - 1, 0)).toEqual([22, 16, 12])
    expect(pixel(0, height - 1)).toEqual([22, 16, 12])
    expect(pixel(width - 1, height - 1)).toEqual([22, 16, 12])
  })
})
