import { PaperPage } from "@/design-system/components/PaperPage"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import { page } from "vitest/browser"

const citation = "Ada Lovelace (1843). Notes on the Analytical Engine. "
  + "Scientific Memoirs. https://example.com/notes"

test("renders the clipping and copies its citation", async () => {
  const writeText = vi
    .spyOn(navigator.clipboard, "writeText")
    .mockResolvedValue()

  await render(
    <PaperPage
      abstract="A full abstract supplied by the metadata source."
      accessLabel="Open access"
      authors={["Ada Lovelace"]}
      bibtexHref="/api/paper.bib?id=10.1000%2Fa%20b"
      citation={citation}
      citations={12}
      externalUrl="https://example.com/notes"
      hiddenByReaders={2}
      likedByReaders={2}
      openedByReaders={2}
      readMinutes={6}
      savedByReaders={2}
      siteLabel="OpenAlex"
      title="Notes on the Analytical Engine"
      topics={["AI"]}
      venue="Scientific Memoirs"
      year={1843}
    />,
  )

  await expect
    .element(
      page.getByRole("heading", { name: "Notes on the Analytical Engine" }),
    )
    .toBeVisible()
  await expect.element(page.getByText(citation)).toBeVisible()

  await page.getByRole("button", { name: "Copy citation" }).click()

  expect(writeText).toHaveBeenCalledWith(citation)
  await expect
    .element(page.getByRole("status"))
    .toHaveTextContent("Citation copied to the clipboard")
  await expect
    .element(page.getByRole("button", { name: "Copied" }))
    .toBeVisible()

  await expect
    .element(page.getByRole("link", { name: "Export BibTeX" }))
    .toHaveAttribute("href", "/api/paper.bib?id=10.1000%2Fa%20b")
})

const markupFor = (
  savedByReaders: number,
  openedByReaders = 0,
  likedByReaders = 0,
  hiddenByReaders = 0,
) =>
  renderToStaticMarkup(
    <PaperPage
      abstract="A full abstract supplied by the metadata source."
      accessLabel="Open access"
      authors={["Ada Lovelace"]}
      bibtexHref="/api/paper.bib?id=10.1000%2Fa%20b"
      citation={citation}
      citations={12}
      externalUrl="https://example.com/notes"
      hiddenByReaders={hiddenByReaders}
      likedByReaders={likedByReaders}
      openedByReaders={openedByReaders}
      readMinutes={6}
      savedByReaders={savedByReaders}
      siteLabel="OpenAlex"
      title="Notes on the Analytical Engine"
      topics={["AI"]}
      venue="Scientific Memoirs"
      year={1843}
    />,
  )

test("prints who filed the clipping", () => {
  const markup = markupFor(3)

  expect(markup).toContain("Filed by")
  expect(markup).toContain("3 readers")
})

test("omits the filing fact when nobody filed it", () => {
  expect(markupFor(0)).not.toContain("Filed by")
})

test("prints who opened the clipping's source", () => {
  const markup = markupFor(0, 3)

  expect(markup).toContain("Opened by")
  expect(markup).toContain("3 readers")
})

test("omits the open-source fact when nobody opened it", () => {
  expect(markupFor(0, 0)).not.toContain("Opened by")
})

test("prints who liked the clipping", () => {
  const markup = markupFor(0, 0, 3)

  expect(markup).toContain("Liked by")
  expect(markup).toContain("3 readers")
})

test("omits the like fact when nobody liked it", () => {
  expect(markupFor(0, 0, 0)).not.toContain("Liked by")
})

test("prints who hid the clipping", () => {
  const markup = markupFor(0, 0, 0, 3)

  expect(markup).toContain("Hidden by")
  expect(markup).toContain("3 readers")
})

test("omits the hide fact when nobody hid it", () => {
  expect(markupFor(0, 0, 0, 0)).not.toContain("Hidden by")
})

test("names the reading time as the abstract's", () => {
  const markup = markupFor(0)

  expect(markup).toContain("Abstract read time")
  expect(markup).toContain("6 min")
})

test("exports the clipping beside the citation control", () => {
  const markup = markupFor(0)

  expect(markup.match(/Export BibTeX/g)).toHaveLength(1)
  expect(markup).toContain("href=\"/api/paper.bib?id=10.1000%2Fa%20b\"")
  expect(markup).toContain("download=\"academitok-clipping.bib\"")
  expect(markup).toContain("Copy citation")
})
