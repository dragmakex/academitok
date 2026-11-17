import { Notice } from "@/design-system/components/Notice"
import { expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import { page } from "vitest/browser"

test("announces the label and offers its single action", async () => {
  const onAction = vi.fn()
  await render(
    <Notice label="Clipped out" action={{ label: "Undo", onAction }} />,
  )

  await expect
    .element(page.getByRole("status"))
    .toHaveTextContent("Clipped out")

  await page.getByRole("button", { name: "Undo" }).click()
  expect(onAction).toHaveBeenCalledOnce()
})

test("renders no control when the notice carries no action", async () => {
  await render(<Notice label="Filed in clippings" />)

  await expect
    .element(page.getByRole("status"))
    .toHaveTextContent("Filed in clippings")
  expect(page.getByRole("button").elements()).toHaveLength(0)
})
