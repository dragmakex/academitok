/**
 * Reader identity for server functions and loaders: resolves the reader id
 * from the incoming request's cookie, minting one when the browser has none
 * (SPEC §17.1). Once an account has claimed that device, requests follow the
 * canonical reader that owns its data.
 */

import {
  type AuthRepository,
  canonicalReaderId,
} from "@/features/auth/application"
import {
  defaultReaderId,
  newReaderId,
  ReaderId,
  readerIdFromCookieHeader,
  sessionReaderCookie,
} from "@/lib/reader-id"
import {
  getRequestHeader,
  setResponseHeader,
} from "@tanstack/react-start/server"
import * as Effect from "effect/Effect"

/**
 * Reader id this request acts as, minting and persisting one if the browser
 * has none. The cookie is `HttpOnly` because it may already stand for an
 * account: the server is its only writer.
 * @param cookieHeader - Raw `Cookie` header of the request.
 * @returns Reader id to act as.
 */
export const claimReaderId = (cookieHeader: string | undefined): string => {
  const claimed = readerIdFromCookieHeader(cookieHeader)
  if (claimed !== defaultReaderId) {
    return claimed
  }

  const minted = newReaderId()
  setResponseHeader("set-cookie", sessionReaderCookie(minted))
  return minted
}

/**
 * Provides the current request's reader id to a server-side effect.
 * @param effect - Effect that needs the reader identity.
 * @returns Effect with the reader identity provided.
 */
export const withRequestReader = <A, E, R>(
  effect: Effect.Effect<A, E, ReaderId | R>,
): Effect.Effect<A, E, AuthRepository | R> => {
  const claimed = claimReaderId(getRequestHeader("cookie"))
  return Effect.flatMap(
    canonicalReaderId(claimed),
    (readerId) => Effect.provideService(effect, ReaderId, readerId),
  )
}
