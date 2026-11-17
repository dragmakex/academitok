/**
 * Engagement ladder, calibrated against X's open-sourced For You ranker
 * (`xai-org/x-algorithm`, `home-mixer/params/param.rs`, October 2026): like
 * 0.708, open-link 0.2, dwell 0.05, continuous dwell 0.0075 per second,
 * click-through dwell 0.385 per second, not-dwelled −0.02, not-interested
 * −53.07. X multiplies predicted probabilities and this feed multiplies
 * observed signal strength, so only the ratios are carried over: like 10
 * implies open-link 2.8, dwell 0.7, dwell 0.1 per second. Saving and hiding
 * have no X analogue and sit between like and share.
 */
export const engagementWeights = {
  skip: -0.4,
  /** An impression is not engagement; it only breaks ties. */
  view: 0.3,
  dwell: 0.7,
  dwellSecond: 0.03,
  openSite: 2.8,
  bookmark: 7,
  like: 10,
  /** First minute away at the source; X's click-dwell weight, scaled. */
  readThrough: 14,
  /** Each extra minute away, up to four, is worth this much more. */
  readThroughMinute: 3.5,
  hide: -30,
  onboardKeep: 10,
  onboardReject: -30,
} as const

/** Visible time below this is a skip, not attention. */
const skipThresholdMs = 1_500

/** Passive dwell stops accruing credit here. */
const dwellCapMs = 30_000

/** Away time after opening a source only counts from this point. */
const readThroughThresholdMs = 60_000

/**
 * Scores one dwell impression. A minute away at the source is reported as a
 * dwell impression too, which is how the away-read is distinguished from
 * passive time on the page.
 * @param dwellMs - Measured visible or away time.
 * @returns Bounded dwell weight.
 */
export function dwellSignal(dwellMs: number): number {
  if (dwellMs < skipThresholdMs) {
    return engagementWeights.skip
  }
  if (dwellMs >= readThroughThresholdMs) {
    const extraMinutes = Math.min(
      4,
      (dwellMs - readThroughThresholdMs) / 60_000,
    )
    return engagementWeights.readThrough
      + extraMinutes * engagementWeights.readThroughMinute
  }
  return engagementWeights.dwell
    + engagementWeights.dwellSecond * Math.min(dwellCapMs, dwellMs) / 1_000
}

/**
 * Maps a stored reaction kind onto the engagement ladder.
 * @param kind - Reaction kind.
 * @returns Weight for that reaction.
 */
export function reactionSignal(
  kind:
    | "view"
    | "like"
    | "bookmark"
    | "hide"
    | "open-site"
    | "onboard-keep"
    | "onboard-reject",
): number {
  switch (kind) {
    case "view":
      return engagementWeights.view
    case "like":
      return engagementWeights.like
    case "bookmark":
      return engagementWeights.bookmark
    case "hide":
      return engagementWeights.hide
    case "open-site":
      return engagementWeights.openSite
    case "onboard-keep":
      return engagementWeights.onboardKeep
    case "onboard-reject":
      return engagementWeights.onboardReject
  }
}
