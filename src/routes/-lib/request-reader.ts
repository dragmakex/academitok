/**
 * Reader identity for server functions and loaders: resolves the anonymous
 * reader id from the incoming request's cookie (SPEC §17.1).
 */

import { ReaderId, readerIdFromCookieHeader } from "@/lib/reader-id"
import { getRequestHeader } from "@tanstack/react-start/server"
import * as Effect from "effect/Effect"

/**
 * Provides the current request's reader id to a server-side effect.
 * @param effect - Effect that needs the reader identity.
 * @returns Effect with the reader identity provided.
 */
export const withRequestReader = <A, E, R>(
  effect: Effect.Effect<A, E, ReaderId | R>,
): Effect.Effect<A, E, R> =>
  Effect.provideService(
    effect,
    ReaderId,
    readerIdFromCookieHeader(getRequestHeader("cookie")),
  )
