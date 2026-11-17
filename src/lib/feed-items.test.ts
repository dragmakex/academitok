import { removeItemAt, restoreItem } from "@/lib/feed-items"
import { describe, expect, it } from "vitest"

const page = ["a", "b", "c"] as const

describe("removeItemAt", () => {
  it("reports the item and the index it left", () => {
    expect(removeItemAt(page, 1)).toEqual({
      items: ["a", "c"],
      removed: { item: "b", index: 1 },
    })
  })

  it("leaves the page untouched for an empty slot", () => {
    expect(removeItemAt(page, 3)).toEqual({ items: page, removed: null })
  })
})

describe("restoreItem", () => {
  it("round-trips a three-item page from every slot", () => {
    for (const index of [0, 1, 2]) {
      const result = removeItemAt(page, index)
      expect(result.removed).not.toBeNull()
      if (result.removed === null) {
        continue
      }
      expect(restoreItem(result.items, result.removed)).toEqual([...page])
    }
  })

  it("clamps a slot past the end of the page", () => {
    expect(restoreItem(["a"], { item: "z", index: 7 })).toEqual(["a", "z"])
  })
})
