import {
  deckAction,
  keyLabel,
  resolveShortcut,
  type ShortcutId,
  shortcutRows,
  shortcuts,
} from "@/lib/shortcuts"
import { describe, expect, it } from "vitest"

const ids: ReadonlyArray<ShortcutId> = [
  "next",
  "previous",
  "like",
  "bookmark",
  "hide",
  "open-site",
  "desk",
  "help",
]

describe("shortcut table", () => {
  it("resolves every documented key to its own binding", () => {
    for (const shortcut of shortcuts) {
      for (const key of shortcut.keys) {
        expect(resolveShortcut(key)?.id).toBe(shortcut.id)
      }
    }
  })

  it("binds each key exactly once", () => {
    const keys = shortcuts.flatMap((shortcut) => shortcut.keys)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("leaves unbound keys unresolved", () => {
    expect(resolveShortcut("x")).toBeUndefined()
    expect(resolveShortcut("Escape")).toBeUndefined()
  })

  it("covers every handled action", () => {
    expect(shortcuts.map((shortcut) => shortcut.id).sort()).toEqual(
      [...ids].sort(),
    )
  })
})

describe("deckAction", () => {
  it("opens and closes the sheet on the help key alone", () => {
    expect(deckAction("?", "deck", "none")).toBe("help")
    expect(deckAction("?", "control", "sheet")).toBe("help")
  })

  it("leaves deck keys inert while a panel owns the keyboard", () => {
    expect(deckAction("j", "deck", "sheet")).toBeUndefined()
    expect(deckAction("l", "deck", "desk")).toBeUndefined()
    expect(deckAction("?", "deck", "desk")).toBeUndefined()
  })

  it("does not steal keys from controls or form fields", () => {
    expect(deckAction("j", "control", "none")).toBeUndefined()
    expect(deckAction("l", "form", "none")).toBeUndefined()
    expect(deckAction("?", "form", "none")).toBeUndefined()
  })

  it("runs real bindings on the deck", () => {
    expect(deckAction("j", "deck", "none")).toBe("next")
    expect(deckAction(" ", "deck", "none")).toBe("next")
    expect(deckAction("k", "deck", "none")).toBe("previous")
    expect(deckAction("d", "deck", "none")).toBe("desk")
    expect(deckAction("x", "deck", "none")).toBeUndefined()
  })
})

describe("keyLabel", () => {
  it("prints named and printable keys for the sheet", () => {
    expect(keyLabel(" ")).toBe("Space")
    expect(keyLabel("ArrowDown")).toBe("↓")
    expect(keyLabel("ArrowUp")).toBe("↑")
    expect(keyLabel("j")).toBe("J")
    expect(keyLabel("?")).toBe("?")
  })
})

describe("shortcutRows", () => {
  it("derives one row per binding from the table", () => {
    expect(shortcutRows).toHaveLength(shortcuts.length)
    expect(shortcutRows[0]).toEqual({
      keys: "↓ / J / Space",
      description: shortcuts[0]?.description,
    })
  })

  it("keeps descriptions unique so the sheet can key rows by them", () => {
    const descriptions = shortcutRows.map((row) => row.description)
    expect(new Set(descriptions).size).toBe(descriptions.length)
  })
})
