/** A destination that accepts prefilled share text. */
export type ShareTarget = {
  readonly label: string
  readonly href: string
}

/** What is being shared, in the words the destination will print. */
export type SharePayload = {
  readonly title: string
  readonly text: string
  readonly url: string
}

const enc = encodeURIComponent

/**
 * Builds prefilled compose links for one paper or one edition.
 *
 * Every platform takes a different combination of the same three fields, and a
 * reader will notice when a link drops the headline, so the mapping lives here
 * once instead of inside the drawer.
 *
 * @param payload - Headline, body copy and canonical link.
 * @param payload.title - Headline shown by the destination.
 * @param payload.text - Body copy written into the post.
 * @param payload.url - Canonical link.
 * @returns One target per platform, printed-label order.
 */
export function shareTargets({ text, title, url }: SharePayload): ReadonlyArray<
  ShareTarget
> {
  const body = text.trim() === "" ? url : `${text}\n\n${url}`
  return [
    {
      label: "X",
      href: `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`,
    },
    {
      label: "Bluesky",
      href: `https://bsky.app/intent/compose?text=${enc(body)}`,
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}&quote=${
        enc(text)
      }`,
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
    },
    {
      label: "Reddit",
      href: `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(title)}`,
    },
    {
      label: "WhatsApp",
      href: `https://api.whatsapp.com/send?text=${enc(body)}`,
    },
    {
      label: "Telegram",
      href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`,
    },
    {
      label: "Email",
      href: `mailto:?subject=${enc(title)}&body=${enc(body)}`,
    },
  ]
}
