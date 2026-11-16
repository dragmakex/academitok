import type { FeedItem } from "@/api/paper-schema"
import { curatedPapers } from "@/data/papers"
import { OnboardingPicks } from "@/routes/-index/app"
import { expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import { page } from "vitest/browser"

const candidates: ReadonlyArray<FeedItem> = curatedPapers.map((paper) => ({
  paper,
  score: 0,
  rationale: [],
  accessible: true,
  liked: false,
  bookmarked: false,
  hidden: false,
  exploration: false,
}))

test("onboarding collects three pages and requires five keeps", async () => {
  const onSubmit = vi.fn()
  await render(
    <OnboardingPicks candidates={candidates} onSubmit={onSubmit} />,
  )

  for (const candidate of candidates.slice(0, 5)) {
    await page
      .getByRole("button", {
        name: `Keep ${candidate.paper.title}`,
      })
      .click()
  }
  await page.getByRole("button", { name: "Next five" }).click()

  for (const candidate of candidates.slice(5, 10)) {
    await page
      .getByRole("button", {
        name: `Discard ${candidate.paper.title}`,
      })
      .click()
  }
  await page.getByRole("button", { name: "Next five" }).click()

  for (const candidate of candidates.slice(10)) {
    await page
      .getByRole("button", {
        name: `Discard ${candidate.paper.title}`,
      })
      .click()
  }
  await page.getByRole("button", { name: "Print my edition" }).click()

  expect(onSubmit).toHaveBeenCalledWith({
    keptPaperIds: candidates.slice(0, 5).map((item) => item.paper.id),
    rejectedPaperIds: candidates.slice(5).map((item) => item.paper.id),
    skipped: false,
  })
})
