import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8")

/**
 * The installed shell draws under the status bar and the home indicator, so
 * the viewport has to opt into the whole screen and the edge-to-edge deck has
 * to give those edges back.
 */
describe("installed-shell safe areas", () => {
  it("opts the viewport into the whole screen", () => {
    expect(source("src/routes/__root.tsx")).toContain("viewport-fit=cover")
  })

  it("pads the deck and the clipping strip by all four insets", () => {
    const deck = source("src/design-system/components/FeedDeck.tsx")
    const slide = source("src/design-system/components/PaperSlide.tsx")

    expect(deck).toContain("env(safe-area-inset-left)")
    expect(deck).toContain("env(safe-area-inset-right)")
    expect(slide).toContain("env(safe-area-inset-top)")
    expect(slide).toContain("env(safe-area-inset-bottom)")
  })
})
