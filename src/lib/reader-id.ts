/**
 * Anonymous reader identity (SPEC §17.1): a first-party cookie carries a
 * generated id, no login. Everything that does not match the id grammar is
 * ignored rather than stored.
 */

import * as Context from "effect/Context"

/** Cookie that carries the anonymous reader id. */
export const readerIdCookieName = "academitok_reader_id"

/** Reader id used when a request carries no valid cookie. */
export const defaultReaderId = "singleton"

const readerIdPattern = /^[A-Za-z0-9-]{8,64}$/
const cookieMaxAgeSeconds = 365 * 24 * 60 * 60

/**
 * Fresh reader id for a browser that has none, or for a sign-out.
 * @returns A random id matching the cookie grammar.
 */
export const newReaderId = (): string => globalThis.crypto.randomUUID()

/**
 * Builds one `Set-Cookie` value for the reader id.
 * @param value - Reader id to carry.
 * @param options - Cookie hardening flags.
 * @param options.httpOnly - Invisible to `document.cookie`, so injected script
 * cannot lift the id once it stands for a signed-in reader.
 * @param options.secure - HTTPS only; required wherever sign-in works.
 * @returns `Set-Cookie` header value.
 */
export const readerCookie = (
  value: string,
  options: { readonly httpOnly: boolean; readonly secure: boolean },
): string =>
  [
    `${readerIdCookieName}=${value}`,
    "Path=/",
    `Max-Age=${cookieMaxAgeSeconds}`,
    "SameSite=Lax",
    ...(options.httpOnly ? ["HttpOnly"] : []),
    ...(options.secure ? ["Secure"] : []),
  ]
    .join("; ")

/**
 * `Set-Cookie` value carrying a fresh, hardened reader id. The cookie is
 * `HttpOnly` from birth because the server is its only writer: once a device
 * is signed in, the id stands for an account.
 * @param readerId - Reader id to carry; a fresh one by default.
 * @returns `Set-Cookie` header value.
 */
export const sessionReaderCookie = (readerId = newReaderId()): string =>
  readerCookie(readerId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  })

/**
 * Reader identity for the current request.
 */
export class ReaderId extends Context.Service<ReaderId, string>()("ReaderId") {}

/**
 * Resolves the reader id from a raw `Cookie` header.
 * @param cookieHeader - Raw `Cookie` header value, when present.
 * @returns The cookie's reader id, or the default id when absent or invalid.
 */
export const readerIdFromCookieHeader = (
  cookieHeader: string | undefined,
): string => {
  const prefix = `${readerIdCookieName}=`
  const value = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length)

  return value !== undefined && readerIdPattern.test(value)
    ? value
    : defaultReaderId
}
