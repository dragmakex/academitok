// @vitest-environment node

import { recordReaderReaction } from "@/features/papers/reactions"
import { describe, expect, it } from "vitest"

describe("papers application", () => {
  it("toggles desk reactions but keeps open-site as an append-only signal", () => {
    const toggledOn = recordReaderReaction([], {
      paperId: "paper-1",
      kind: "like",
    })

    expect(toggledOn[0]).toMatchObject({
      paperId: "paper-1",
      kind: "like",
      active: true,
    })

    const toggledOff = recordReaderReaction(toggledOn, {
      paperId: "paper-1",
      kind: "like",
    })

    expect(toggledOff[0]).toMatchObject({
      paperId: "paper-1",
      kind: "like",
      active: false,
    })

    const toggledOnAgain = recordReaderReaction(toggledOff, {
      paperId: "paper-1",
      kind: "like",
    })

    expect(toggledOnAgain[0]).toMatchObject({
      paperId: "paper-1",
      kind: "like",
      active: true,
    })

    const openedOnce = recordReaderReaction([], {
      paperId: "paper-1",
      kind: "open-site",
    })
    const openedTwice = recordReaderReaction(openedOnce, {
      paperId: "paper-1",
      kind: "open-site",
    })

    expect(openedTwice[0]).toMatchObject({
      paperId: "paper-1",
      kind: "open-site",
      active: true,
    })
    expect(openedTwice[1]).toMatchObject({
      paperId: "paper-1",
      kind: "open-site",
      active: true,
    })

    const dwelled = recordReaderReaction([], {
      paperId: "paper-1",
      kind: "dwell",
      dwellMs: 12_000,
      position: 0,
      exploration: false,
    })
    expect(dwelled[0]).toMatchObject({ kind: "dwell", dwellMs: 12_000 })
  })
})
