import { PaperPage } from "@/design-system/components/PaperPage"
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
      citation={citation}
      citations={12}
      externalUrl="https://example.com/notes"
      readMinutes={6}
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
})
