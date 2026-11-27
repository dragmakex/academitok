/** What is being shared, in the words the destination will print. */
export type SharePayload = {
  readonly title: string
  readonly text: string
  readonly url: string
}

/**
 * Offers the app itself when a reader wants to pass AcademiTok on.
 *
 * A whole edition is not a thing anyone can use outside the app, so the desk
 * shares the door, not the papers behind it.
 *
 * @param url - Origin the deck is served from.
 * @returns Payload for the browser's share sheet.
 */
export const appShare = (url: string): SharePayload => ({
  title: "AcademiTok",
  text: "AcademiTok — the day's papers, one swipe at a time.",
  url,
})

/**
 * Offers one clipping with its headline, byline and permalink.
 *
 * @param paper - Clipping metadata.
 * @param paper.authors - Byline as printed on the slide.
 * @param paper.permalink - Canonical link in this site.
 * @param paper.title - Headline.
 * @param paper.year - Publication year.
 * @returns Payload for the browser's share sheet.
 */
export const paperShare = (
  { authors, permalink, title, year }: {
    readonly authors: string
    readonly permalink: string
    readonly title: string
    readonly year: number
  },
): SharePayload => ({
  title,
  text: `${title} — ${authors} (${year}) · Found on AcademiTok`,
  url: permalink,
})

/** What the reader did with the share sheet. */
export type ShareOutcome = "shared" | "copied" | "dismissed" | "failed"

/** The slice of `navigator` sharing needs, so a test can hand in its own. */
export type ShareHost = {
  readonly share?: ((payload: SharePayload) => Promise<void>) | undefined
  readonly clipboard: { readonly writeText: (text: string) => Promise<void> }
}

/**
 * Opens the platform share sheet, falling back to copying the link.
 *
 * The sheet is the point: it is where the reader picks the network, or picks
 * "copy link". Dismissing it is not a failure, so it files no notice.
 *
 * @param payload - What to share.
 * @param host - Navigator-like object carrying `share` and `clipboard`.
 * @returns What happened, so the caller knows whether to say anything.
 */
export async function sharePayload(
  payload: SharePayload,
  host: ShareHost,
): Promise<ShareOutcome> {
  if (host.share !== undefined) {
    try {
      await host.share(payload)
      return "shared"
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return "dismissed"
      }
    }
  }
  try {
    await host.clipboard.writeText(payload.url)
    return "copied"
  } catch {
    return "failed"
  }
}
