/**
 * Sign-in application layer (SPEC §17.5): mint a link, mail it, and spend it.
 *
 * Signing in never creates a new reader — it claims the reader the browser
 * already has, so the taste and clippings accumulated anonymously carry over,
 * and a second device folds into the same account.
 */

import type { SessionInfo, SignInRequestResult } from "@/api/auth-schema"
import { ReaderStateRepository } from "@/db/reader-state-repository"
import {
  magicLinkTtlMs,
  newLinkToken,
  normaliseEmail,
  tokenHash,
} from "@/lib/magic-link"
import { type Mailer, MailerLive } from "@/lib/mailer"
import { ReaderId } from "@/lib/reader-id"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

/** Data services the auth application reads through. */
export type AuthRepository = ReaderStateRepository

/** Delivers sign-in mail; replaced in tests. */
export class Mail extends Context.Service<Mail, Mailer>()("Mail") {
  static readonly layer = Layer.succeed(this, MailerLive)
}

/** Every layer the auth application needs. */
export const AuthLive = Mail.layer

const originPattern = /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i

/**
 * Splits the configured origin allowlist.
 * @param raw - Comma-separated origins from `AUTH_ORIGINS`.
 * @returns Allowed origins, empty when unset.
 */
export const allowedOrigins = (raw: string): ReadonlyArray<string> =>
  raw.split(",").map((origin) => origin.trim()).filter((origin) =>
    origin !== ""
  )

/**
 * Checks the origin a sign-in link should point at.
 * @param requested - Origin the browser reported.
 * @param allowed - Origins from configuration; empty allows any well-formed one.
 * @returns The origin to embed in the link, or null when refused.
 */
export const resolveSignInOrigin = (
  requested: string,
  allowed: ReadonlyArray<string>,
): string | null => {
  if (!originPattern.test(requested)) {
    return null
  }
  const origin = requested.replace(/\/+$/, "")
  return allowed.length === 0 || allowed.includes(origin) ? origin : null
}

/**
 * Mails a sign-in link for an address.
 * @param input - Address and the origin to return to.
 * @param input.email - Address the reader typed, normalised before use.
 * @param input.origin - Origin the link must return to; validated before use.
 * @returns Whether a link was recorded and mailed.
 */
export const requestSignInLink = (
  input: { readonly email: string; readonly origin: string },
): Effect.Effect<
  SignInRequestResult,
  never,
  ReaderStateRepository | ReaderId | Mail
> =>
  Effect.gen(function*() {
    const email = normaliseEmail(input.email)
    if (email === null) {
      return { sent: false }
    }
    const origin = resolveSignInOrigin(
      input.origin,
      allowedOrigins(process.env.AUTH_ORIGINS ?? ""),
    )
    if (origin === null) {
      return { sent: false }
    }

    const repository = yield* ReaderStateRepository
    const readerId = yield* ReaderId
    const token = newLinkToken()
    const now = new Date()
    const recorded = yield* Effect.promise(() =>
      repository.accounts.requestLink({
        email,
        readerId,
        tokenHash: tokenHash(token),
        now,
        expiresAt: new Date(now.getTime() + magicLinkTtlMs),
      })
    )
    // A capped address still answers "sent": the deck must not reveal which
    // addresses have accounts.
    if (!recorded) {
      return { sent: true }
    }

    const mail = yield* Mail
    yield* mail.sendMagicLink(email, token, origin).pipe(
      Effect.catch(() =>
        Effect.logWarning(`sign-in mail to ${email} could not be sent`)
      ),
    )
    return { sent: true }
  })

/**
 * Spends a sign-in link and claims the current reader.
 * @param token - Plaintext token from the link.
 * @returns The address now signed in, or null when the link is spent.
 */
export const verifySignInLink = (
  token: string,
): Effect.Effect<SessionInfo, never, ReaderStateRepository | ReaderId> =>
  Effect.gen(function*() {
    const repository = yield* ReaderStateRepository
    const readerId = yield* ReaderId
    const session = yield* Effect.promise(() =>
      repository.accounts.consumeLink({
        tokenHash: tokenHash(token),
        readerId,
        now: new Date(),
      })
    )
    return { email: session?.email ?? null }
  })

/**
 * Resolves the reader that owns an account's data.
 * @param claimed - Reader id from the request cookie.
 * @returns The account's canonical reader, or the given id when unclaimed.
 */
export const canonicalReaderId = (
  claimed: string,
): Effect.Effect<string, never, ReaderStateRepository> =>
  Effect.gen(function*() {
    const repository = yield* ReaderStateRepository
    return yield* Effect.promise(() =>
      repository.accounts.canonicalReaderId(claimed)
    )
  })

/**
 * Reads the account the current reader is signed in to.
 * @returns The signed-in address, or null when anonymous.
 */
export const readSession = Effect.gen(function*() {
  const repository = yield* ReaderStateRepository
  const readerId = yield* ReaderId
  return yield* Effect.promise(() => repository.accounts.session(readerId))
})
