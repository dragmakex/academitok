import { Button } from "@/design-system/components/Button"
import { ShortcutSheet } from "@/design-system/components/ShortcutSheet"
import { shortcutRows } from "@/lib/shortcuts"
import { useState } from "react"
import { expect, test } from "vitest"
import { render } from "vitest-browser-react"
import { page, userEvent } from "vitest/browser"

/**
 * Controlled host so the sheet's open, close and focus-restore paths run.
 * @returns Opener button and the sheet it controls.
 */
function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        Open shortcuts
      </Button>
      <ShortcutSheet
        open={open}
        onOpenChange={setOpen}
        title="Keyboard shortcuts"
        items={shortcutRows}
      />
    </>
  )
}

test("the sheet lists every binding and nothing else", async () => {
  await render(<Harness />)
  await page.getByRole("button", { name: "Open shortcuts" }).click()

  const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" })
  await expect.element(dialog).toBeVisible()

  for (const row of shortcutRows) {
    await expect
      .element(page.getByText(row.keys, { exact: true }))
      .toBeVisible()
    await expect.element(page.getByText(row.description)).toBeVisible()
  }
  expect(dialog.getByRole("listitem").elements()).toHaveLength(
    shortcutRows.length,
  )
})

test("escape closes the sheet and returns focus to the opener", async () => {
  await render(<Harness />)
  const opener = page.getByRole("button", { name: "Open shortcuts" })
  await opener.click()
  await expect
    .element(page.getByRole("dialog", { name: "Keyboard shortcuts" }))
    .toBeVisible()

  await userEvent.keyboard("{Escape}")

  await expect
    .element(page.getByRole("dialog", { name: "Keyboard shortcuts" }))
    .not
    .toBeInTheDocument()
  await expect.element(opener).toHaveFocus()
})
