/**
 * Feed page edits that must be reversible.
 *
 * Hiding a clipping drops it from the loaded page; the notice line offers an
 * undo, so removal hands back the item and the slot it came from instead of a
 * bare filtered list.
 *
 * @see SPEC.md §5.2
 */

/** An item taken off a page, with the index it occupied. */
export type RemovedItem<A> = {
  readonly item: A
  readonly index: number
}

/**
 * Removes the item at an index and reports what left the page.
 * @param items - Loaded page.
 * @param index - Slot to clear.
 * @returns The shortened page and the removal, or the page untouched when the slot is empty.
 */
export function removeItemAt<A>(
  items: ReadonlyArray<A>,
  index: number,
): {
  readonly items: ReadonlyArray<A>
  readonly removed: RemovedItem<A> | null
} {
  const item = items[index]
  if (item === undefined) {
    return { items, removed: null }
  }

  return {
    items: [...items.slice(0, index), ...items.slice(index + 1)],
    removed: { item, index },
  }
}

/**
 * Puts a removed item back in its slot.
 * @param items - Loaded page.
 * @param removed - Removal returned by `removeItemAt`.
 * @returns Page with the item restored at, or clamped to the end of, its old index.
 */
export function restoreItem<A>(
  items: ReadonlyArray<A>,
  removed: RemovedItem<A>,
): ReadonlyArray<A> {
  const index = Math.max(0, Math.min(items.length, removed.index))

  return [...items.slice(0, index), removed.item, ...items.slice(index)]
}
