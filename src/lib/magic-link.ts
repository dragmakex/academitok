/**
 * Magic-link sign-in tokens (SPEC §17.5). The link is the credential: the
 * plaintext token leaves the server once, inside the mail, and only its SHA-256
 * digest is stored, so a database read never yields a usable link.
 */

import { createHash, randomBytes } from "node:crypto"

/** Lifetime of a sign-in link. */
export const magicLinkTtlMs = 15 * 60 * 1_000

/** Links one address may request per hour before further requests are dropped. */
export const maxLinksPerHour = 3

/** Entropy per token, in bytes. */
const tokenBytes = 32

/** Where a requested link points; the route consumes the token. */
export const verifyPath = "/auth/verify"

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Fresh plaintext token for one sign-in link.
 * @returns URL-safe random token.
 */
export const newLinkToken = (): string =>
  randomBytes(tokenBytes).toString("base64url")

/**
 * Digest stored instead of the plaintext token.
 * @param token - Plaintext token from the link.
 * @returns Hex SHA-256 digest.
 */
export const tokenHash = (token: string): string =>
  createHash("sha256").update(token).digest("hex")

/**
 * Canonical form of an address, or null when it is not one.
 * @param raw - Address as typed by the reader.
 * @returns Trimmed lowercase address, or null when malformed.
 */
export const normaliseEmail = (raw: string): string | null => {
  const email = raw.trim().toLowerCase()
  return email.length <= 254 && emailPattern.test(email) ? email : null
}

/**
 * Absolute sign-in URL carried by the mail.
 * @param baseUrl - Origin the request arrived on.
 * @param token - Plaintext token.
 * @returns Absolute URL to the verify route.
 */
export const signInUrl = (baseUrl: string, token: string): string =>
  `${baseUrl.replace(/\/+$/, "")}${verifyPath}?token=${
    encodeURIComponent(token)
  }`

/**
 * Whether a stored token can still sign a reader in.
 * @param stored - Stored expiry and consumption instant.
 * @param stored.expiresAt - Instant the link stops working.
 * @param stored.consumedAt - Instant the link was used, or null.
 * @param now - Current time.
 * @returns True while the token is unused and unexpired.
 */
export const isTokenLive = (
  stored: { readonly expiresAt: Date; readonly consumedAt: Date | null },
  now: Date,
): boolean =>
  stored.consumedAt === null && stored.expiresAt.getTime() > now.getTime()
