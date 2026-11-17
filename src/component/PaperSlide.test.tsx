import { PaperSlide } from "@/design-system/components/PaperSlide"
import { renderToStaticMarkup } from "react-dom/server"
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

test("compact clipping renders a list row with an unsave action", async () => {
  const onUnsave = vi.fn()
  await render(
    <PaperSlide
      variant="compact"
      id="paper-2"
      title="Saved Clipping"
      authors="Ada Lovelace"
      venue="Journal of Kept Papers"
      year={2026}
      abstract="A kept abstract supplied by the metadata source."
      accessLabel="Open access"
      siteLabel="OpenAlex"
      citations={9}
      readMinutes={3}
      topics={["AI"]}
      externalUrl="https://example.com/saved"
      onUnsave={onUnsave}
    />,
  )

  await expect
    .element(page.getByRole("heading", { name: "Saved Clipping" }))
    .toBeVisible()
  await expect
    .element(page.getByText(/Journal of Kept Papers/))
    .toBeVisible()

  await page
    .getByRole("button", { name: "Remove Saved Clipping from saved" })
    .click()
  expect(onUnsave).toHaveBeenCalledOnce()
})

test("compact clipping headlines link to its permalink", () => {
  const html = renderToStaticMarkup(
    <PaperSlide
      variant="compact"
      id="10.1000/a b"
      title="Saved Clipping"
      authors="Ada Lovelace"
      venue="Journal of Kept Papers"
      year={2026}
      abstract="A kept abstract supplied by the metadata source."
      accessLabel="Open access"
      siteLabel="OpenAlex"
      citations={9}
      readMinutes={3}
      topics={["AI"]}
      externalUrl="https://example.com/saved"
      onUnsave={() => {}}
    />,
  )

  expect(html).toContain("href=\"/paper/10.1000%2Fa%20b\"")
  expect(html).toContain(">Saved Clipping</a>")
  expect(html.match(/href="\/paper\//g)).toHaveLength(1)
  expect(html).toContain(">Source</a>")
  expect(html).toContain(">Remove</button>")
})

test("PaperSlide renders metadata and exposes accessible actions", async () => {
  await render(
    <PaperSlide
      id="paper-1"
      origin="pool"
      pinned={false}
      again={false}
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
  await expect
    .element(page.getByRole("link", {
      name: "Open the permalink page for this paper",
    }))
    .toHaveAttribute("href", "/paper/paper-1")
})
