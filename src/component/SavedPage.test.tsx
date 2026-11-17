import { SavedPage } from "@/routes/-saved/saved"
import { expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import { page } from "vitest/browser"

const store = vi.hoisted(() => ({ saved: undefined as unknown }))

vi.mock("@effect/atom-react", () => ({
  useAtomValue: () => ({ _tag: "Success", value: store.saved }),
  useAtomSet: () => () => {},
  useAtomRefresh: () => () => {},
}))

vi.mock("@/routes/-index/atoms", () => ({
  savedPageAtom: { _tag: "SavedPageAtom" },
  removeSavedPaperAtom: { _tag: "RemoveSavedPaperAtom" },
}))

const clipping = {
  paper: {
    id: "paper-bibtex",
    title: "A Kept Clipping",
    authors: ["Ada Lovelace"],
    venue: "Journal of Kept Papers",
    year: 2026,
    summary: "A kept abstract supplied by the metadata source.",
    access: "open" as const,
    accessible: true,
    site: "OpenAlex",
    citations: 9,
    readMinutes: 3,
    topics: ["AI" as const],
    externalUrl: "https://example.com/kept",
  },
  exploration: false,
  again: false,
}

const savedPage = (items: ReadonlyArray<unknown>) => ({
  items,
  nextCursor: null,
  exploration: 0,
})

test("the morgue file offers the BibTeX export when clippings exist", async () => {
  store.saved = savedPage([clipping])
  await render(<SavedPage />)

  const exportLink = page.getByRole("link", { name: "Export BibTeX" })
  await expect.element(exportLink).toBeVisible()
  await expect
    .element(exportLink)
    .toHaveAttribute("href", "/api/saved.bib")
  await expect
    .element(exportLink)
    .toHaveAttribute("download", "academitok-saved.bib")
})

test("an empty morgue file hides the BibTeX export", async () => {
  store.saved = savedPage([])
  await render(<SavedPage />)

  await expect
    .element(page.getByRole("heading", { name: "No clippings saved yet" }))
    .toBeVisible()
  expect(page.getByRole("link", { name: "Export BibTeX" }).elements())
    .toHaveLength(
      0,
    )
})
