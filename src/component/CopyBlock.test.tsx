import { CopyBlock } from "@/design-system/components/CopyBlock"
import { expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import { page } from "vitest/browser"

test("reports a clipboard failure instead of failing silently", async () => {
  vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(
    new Error("denied"),
  )

  await render(
    <CopyBlock
      actionLabel="Copy edition"
      announcement="Edition copied to the clipboard"
      label="Share this edition"
      text={"AcademiTok · Evening Edition · Folio 001\nAI — A headline — Ada (1843) — https://example.com"}
    />,
  )

  await page.getByRole("button", { name: "Copy edition" }).click()

  await expect
    .element(page.getByRole("status"))
    .toHaveTextContent("Could not copy to the clipboard")
  await expect
    .element(page.getByRole("button", { name: "Copy failed" }))
    .toBeVisible()
})

test("keeps the control disabled for an empty notice", async () => {
  await render(
    <CopyBlock
      actionLabel="Copy edition"
      announcement="Edition copied to the clipboard"
      label="Share this edition"
      text=""
    />,
  )

  await expect
    .element(page.getByRole("button", { name: "Copy edition" }))
    .toBeDisabled()
})
