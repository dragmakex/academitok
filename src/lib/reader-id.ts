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

/**
 * Writes the reader cookie when the browser has none; no-op elsewhere.
 */
export const ensureReaderIdCookie = (): void => {
  if (
    typeof document === "undefined"
    || typeof crypto === "undefined"
    || readerIdFromCookieHeader(document.cookie) !== defaultReaderId
  ) {
    return
  }

  document.cookie =
    `${readerIdCookieName}=${crypto.randomUUID()}; Path=/; Max-Age=${cookieMaxAgeSeconds}; SameSite=Lax`
}
