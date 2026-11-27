import type { FeedItem } from "@/api/paper-schema"
import { curatedPapers } from "@/data/papers"
import { OnboardingPicks } from "@/routes/-index/app"
import { expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import { page } from "vitest/browser"

const candidates: ReadonlyArray<FeedItem> = curatedPapers.map((paper) => ({
  paper,
  score: 0,
  accessible: true,
  liked: false,
  bookmarked: false,
  hidden: false,
  exploration: false,
  again: false,
}))

test("onboarding collects five swipe pages and prints undecided papers as skips", async () => {
  const onSubmit = vi.fn()
  await render(
    <OnboardingPicks candidates={candidates} onSubmit={onSubmit} />,
  )

  // Fewer than three keeps leaves the first page: the algorithm needs a seed.
  await page
    .getByRole("button", { name: `Keep ${candidates[0]!.paper.title}` })
    .click()
  await expect
    .element(page.getByRole("button", { name: "Next" }).nth(0))
    .toBeDisabled()

  // Three keeps on page one unlock the walk; two more on page two reach five.
  await page
    .getByRole("button", { name: `Keep ${candidates[0]!.paper.title}` })
    .click()
  for (const candidate of candidates.slice(1, 5)) {
    await page
      .getByRole("button", { name: `Keep ${candidate.paper.title}` })
      .click()
  }
  await page
    .getByRole("button", { name: "Next" })
    .nth(0)
    .click()
  await page
    .getByRole("button", { name: "Next" })
    .nth(1)
    .click()
  await page
    .getByRole("button", { name: "Next" })
    .nth(2)
    .click()
  await page
    .getByRole("button", { name: "Next" })
    .nth(3)
    .click()

  // Print edition works without a magic link: the cookie already carries identity.
  await page.getByRole("button", { name: "Print edition" }).click()

  expect(onSubmit).toHaveBeenCalledWith({
    keptPaperIds: candidates.slice(0, 5).map((item) => item.paper.id),
    rejectedPaperIds: candidates.slice(5).map((item) => item.paper.id),
    skipped: false,
  })
})
