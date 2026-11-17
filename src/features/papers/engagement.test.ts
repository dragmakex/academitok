import {
  dwellSignal,
  engagementWeights,
  reactionSignal,
} from "@/features/papers/engagement"
import { describe, expect, it } from "vitest"

describe("engagement ladder", () => {
  it("prices a like above a save, a source open, a dwell, and a view", () => {
    expect(reactionSignal("like")).toBeGreaterThan(reactionSignal("bookmark"))
    expect(reactionSignal("bookmark")).toBeGreaterThan(
      reactionSignal("open-site"),
    )
    expect(reactionSignal("open-site")).toBeGreaterThan(
      engagementWeights.dwell,
    )
    expect(engagementWeights.dwell).toBeGreaterThan(reactionSignal("view"))
    expect(engagementWeights.skip).toBeLessThan(0)
    expect(reactionSignal("view")).toBeGreaterThan(0)
  })

  it("prices a dislike below every positive signal", () => {
    expect(reactionSignal("hide")).toBeLessThan(engagementWeights.skip)
    expect(reactionSignal("onboard-reject")).toBeLessThan(
      engagementWeights.skip,
    )
  })

  it("counts a long read above a like, but on-page time below an open", () => {
    const awayRead = dwellSignal(5 * 60_000)
    const longOnPage = dwellSignal(45_000)
    const glance = dwellSignal(9_000)

    expect(awayRead).toBeGreaterThan(reactionSignal("like"))
    expect(awayRead).toBeGreaterThan(dwellSignal(60_000))
    expect(dwellSignal(5 * 60_000)).toBeGreaterThan(dwellSignal(90_000))
    expect(longOnPage).toBeLessThan(reactionSignal("open-site"))
    expect(glance).toBeGreaterThan(engagementWeights.skip)
    expect(glance).toBeLessThan(longOnPage)
  })

  it("treats a sub-second swipe as a skip, not attention", () => {
    expect(dwellSignal(0)).toBe(engagementWeights.skip)
    expect(dwellSignal(1_400)).toBe(engagementWeights.skip)
    expect(dwellSignal(1_500)).toBeGreaterThan(engagementWeights.skip)
  })

  it("stops paying for passive dwell past the cap", () => {
    expect(dwellSignal(30_000)).toBeCloseTo(dwellSignal(59_000))
  })
})
