/**
 * Deck keyboard bindings.
 *
 * One table, two readers: the deck key handler acts on `resolveShortcut` and the
 * shortcut sheet renders the same rows, so the printed sheet cannot drift from
 * the implemented bindings.
 *
 * @see SPEC.md §5.2
 */

export type ShortcutId =
  | "next"
  | "previous"
  | "like"
  | "bookmark"
  | "hide"
  | "open-site"
  | "desk"
  | "help"

type Shortcut = {
  readonly id: ShortcutId
  /** `KeyboardEvent.key` values that trigger the binding. */
  readonly keys: ReadonlyArray<string>
  readonly description: string
}

export const shortcuts: ReadonlyArray<Shortcut> = [
  {
    id: "next",
    keys: ["ArrowDown", "j", " "],
    description: "Next clipping",
  },
  {
    id: "previous",
    keys: ["ArrowUp", "k"],
    description: "Previous clipping",
  },
  { id: "like", keys: ["l"], description: "Like" },
  { id: "bookmark", keys: ["s"], description: "Save to clippings" },
  { id: "hide", keys: ["h"], description: "Hide and penalise the topic" },
  { id: "open-site", keys: ["o"], description: "Open the source" },
  { id: "desk", keys: ["d"], description: "Open the reading desk" },
  { id: "help", keys: ["?"], description: "Open or close this sheet" },
] as const

const keyLabels: Readonly<Record<string, string>> = {
  " ": "Space",
  "ArrowDown": "↓",
  "ArrowUp": "↑",
  "?": "?",
}

/**
 * Renders a `KeyboardEvent.key` value for the printed sheet.
 * @param key - Key value from the binding table.
 * @returns Human-readable key text.
 */
export function keyLabel(key: string): string {
  return keyLabels[key] ?? key.toUpperCase()
}

/**
 * Finds the binding for a key event.
 * @param key - `KeyboardEvent.key` value.
 * @returns The binding, or undefined when the key is unbound.
 */
export function resolveShortcut(key: string): Shortcut | undefined {
  return shortcuts.find((shortcut) => shortcut.keys.includes(key))
}

/** Where the keystroke landed. */
export type DeckFocus = "form" | "control" | "deck"

/** Which panel, if any, owns the keyboard. */
export type DeckPanel = "none" | "desk" | "sheet"

/**
 * Decides what a keystroke does while the deck is mounted.
 * @param key - `KeyboardEvent.key` value.
 * @param focus - Whether the keystroke landed in a form field, another control or the deck.
 * @param panel - Open panel, if any.
 * @returns The action to run, or undefined when the keystroke is inert.
 */
export function deckAction(
  key: string,
  focus: DeckFocus,
  panel: DeckPanel,
): ShortcutId | undefined {
  if (focus === "form") {
    return undefined
  }

  const shortcut = resolveShortcut(key)
  if (shortcut === undefined) {
    return undefined
  }
  if (shortcut.id === "help") {
    return panel === "desk" ? undefined : "help"
  }
  return panel === "none" && focus === "deck" ? shortcut.id : undefined
}

export type ShortcutRow = {
  readonly keys: string
  readonly description: string
}

/** Shortcut sheet rows, derived from the binding table. */
export const shortcutRows: ReadonlyArray<ShortcutRow> = shortcuts.map((
  shortcut,
) => ({
  keys: shortcut.keys.map(keyLabel).join(" / "),
  description: shortcut.description,
}))
