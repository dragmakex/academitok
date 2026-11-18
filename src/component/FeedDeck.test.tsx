import { FeedDeck } from "@/design-system/components/FeedDeck"
import { expect, test } from "vitest"
import { render } from "vitest-browser-react"

test("only the nameplate and the paper are readable on the newspaper field", async () => {
  await render(
    <FeedDeck>
      <article>
        Current paper
      </article>
    </FeedDeck>,
  )
  const deck = document.querySelector(
    "section[aria-label=\"Academic paper feed\"]",
  )
  expect(deck?.textContent).toBe("AcademiTokCurrent paper")
  expect(deck?.querySelector("footer")?.textContent).toBe("")
})
