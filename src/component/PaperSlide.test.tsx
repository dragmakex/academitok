import { PaperSlide } from "@/design-system/components/PaperSlide"
import { expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import { page } from "vitest/browser"

const actions = {
  onLike: vi.fn(),
  onBookmark: vi.fn(),
  onHide: vi.fn(),
  onOpenSite: vi.fn(),
  onPrevious: vi.fn(),
  onNext: vi.fn(),
}

test("PaperSlide renders metadata and exposes accessible actions", async () => {
  await render(
    <PaperSlide
      id="paper-1"
      title="Transparent Scientific Discovery"
      authors="Ada Lovelace, Grace Hopper"
      venue="Journal of Useful Results"
      year={2026}
      abstract="A real abstract supplied by the metadata source."
      accessLabel="Open access"
      siteLabel="OpenAlex"
      citations={42}
      readMinutes={6}
      rationale={["Matches AI"]}
      topics={["AI"]}
      liked={false}
      bookmarked={true}
      externalUrl="https://example.com/paper"
      actions={actions}
      position={2}
      total={10}
      skeleton={false}
    />,
  )

  await expect
    .element(page.getByRole("heading", {
      name: "Transparent Scientific Discovery",
    }))
    .toBeVisible()
  await expect
    .element(page.getByText(/Journal of Useful Results/))
    .toBeVisible()
  await expect
    .element(page.getByRole("button", { name: "Like paper" }))
    .toHaveAttribute(
      "aria-pressed",
      "false",
    )
  await expect
    .element(page.getByRole("button", {
      name: "Remove saved paper",
    }))
    .toHaveAttribute("aria-pressed", "true")
  await expect
    .element(page.getByRole("link", {
      name: "Open paper source in a new tab",
    }))
    .toHaveAttribute("rel", "noopener noreferrer")
})
