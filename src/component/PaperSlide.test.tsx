import { PaperSlide } from "@/design-system/components/PaperSlide"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import { page } from "vitest/browser"

const actions = {
  onLike: vi.fn(),
  onBookmark: vi.fn(),
  onShare: vi.fn(),
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
  expect(html).toContain("3 min abstract")
  expect(html).toContain(">Saved Clipping</a>")
  expect(html.match(/href="\/paper\//g)).toHaveLength(1)
  expect(html).toContain(">Source</a>")
  expect(html).toContain(">Remove</button>")
})

test("the deck slide is one paper, one screen, one way out", async () => {
  const html = renderToStaticMarkup(
    <PaperSlide
      id="paper-1"
      title="Transparent Scientific Discovery"
      abstract="A real abstract supplied by the metadata source."
      citations={42}
      readMinutes={6}
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

  // Essentials only: beat, citation count, reading estimate, headline, abstract.
  expect(html).toContain("AI")
  expect(html).toContain("42 citations")
  expect(html).toContain("6 min read")
  expect(html).toContain("Transparent Scientific Discovery")
  expect(html).toContain("A real abstract supplied by the metadata source.")

  // The whole sheet is the source link; nothing else competes with it.
  expect(html).toContain("href=\"https://example.com/paper\"")
  expect(html).toContain("rel=\"noopener noreferrer\"")
  expect(html.match(/href="https:\/\//g)).toHaveLength(1)

  // Every piece of furniture the redesign removed stays removed.
  for (
    const dropped of [
      "Why this",
      "Also in this edition",
      "Also kept by",
      "Also liked by",
      "Metadata only",
      "Evening edition",
      "The record",
      "OpenAlex",
      "Journal of",
    ]
  ) {
    expect(html).not.toContain(dropped)
  }
})

test("the deck slide toggles like and save without leaving the page", async () => {
  await render(
    <PaperSlide
      id="paper-1"
      title="Transparent Scientific Discovery"
      abstract="A real abstract supplied by the metadata source."
      citations={42}
      readMinutes={6}
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
    .element(page.getByRole("button", { name: "Like paper" }))
    .toHaveAttribute("aria-pressed", "false")
  await expect
    .element(page.getByRole("button", { name: "Remove saved paper" }))
    .toHaveAttribute("aria-pressed", "true")
  await expect
    .element(page.getByRole("link", { name: "Open paper source in a new tab" }))
    .toHaveAttribute("rel", "noopener noreferrer")
})

test("the deck slide shares the paper and keeps its foot band full width", async () => {
  await render(
    <PaperSlide
      id="paper-1"
      title="Transparent Scientific Discovery"
      abstract="A real abstract supplied by the metadata source."
      citations={42}
      readMinutes={6}
      topics={["AI"]}
      liked={false}
      bookmarked={false}
      externalUrl="https://example.com/paper"
      actions={actions}
      position={2}
      total={10}
      skeleton={false}
    />,
  )

  await page.getByRole("button", { name: "Share paper" }).click()
  expect(actions.onShare).toHaveBeenCalledOnce()

  // The foot band is the nameplate's twin: full-bleed stock on its own paper.
  const band = document.querySelector("article > div:last-child")
  expect(band?.className).toContain("border-t-[3px]")
  expect(band?.className).toContain("bg-paper")
  expect(band?.className).not.toContain("max-w-")
})
