import { Badge } from "@/design-system/components/Badge"
import { expect, test } from "vitest"
import { render } from "vitest-browser-react"
import { page } from "vitest/browser"

test("Badge uses the monochrome print contract", async () => {
  await render(
    <Badge>
      Due 26. März 2026
    </Badge>,
  )

  const badge = page.getByText("Due 26. März 2026")

  await expect.element(badge).toBeVisible()
  await expect.element(badge).toHaveClass(/bg-paper/)
  await expect.element(badge).toHaveClass(/text-ink/)
  await expect.element(badge).toHaveClass(/border-ink/)
})

test("Badge inverts ink for the accent tone and stays monochrome", async () => {
  await render(
    <>
      <Badge tone="accent">
        Accent
      </Badge>
      <Badge tone="success">
        Success
      </Badge>
      <Badge tone="danger">
        Danger
      </Badge>
    </>,
  )

  await expect.element(page.getByText("Accent")).toHaveClass(/bg-ink/)
  await expect.element(page.getByText("Accent")).toHaveClass(/text-paper/)
  await expect.element(page.getByText("Success")).toHaveClass(/bg-paper/)
  await expect.element(page.getByText("Danger")).toHaveClass(/bg-paper/)
})
