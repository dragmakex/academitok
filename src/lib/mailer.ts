/**
 * Sign-in mail delivery (SPEC §17.5). Production posts to Resend over plain
 * `fetch`, so the feature adds no dependency; without a key the link is logged
 * to the server console, which is all a local run needs.
 */

import { signInUrl } from "@/lib/magic-link"
import * as Effect from "effect/Effect"

const resendEndpoint = "https://api.resend.com/emails"

/** Subject line of the sign-in mail. */
export const mailSubject = "Your AcademiTok sign-in link"

/**
 * Plain-text body of the sign-in mail.
 * @param url - Absolute sign-in URL.
 * @returns Mail body.
 */
export const mailBody = (url: string): string =>
  [
    "Open this link to carry your reading desk across devices:",
    "",
    url,
    "",
    "The link works once and expires in 15 minutes.",
    "If you did not ask for it, ignore this mail — nothing changes.",
  ]
    .join("\n")

export type MailerConfig = {
  readonly apiKey: string | undefined
  readonly from: string | undefined
  readonly fetchImpl: typeof fetch
}

export interface Mailer {
  /**
   * Sends the sign-in link.
   * @param to - Address that asked for the link.
   * @param token - Plaintext link token.
   * @param baseUrl - Origin the request arrived on.
   * @returns Delivery effect; a non-2xx answer fails.
   */
  readonly sendMagicLink: (
    to: string,
    token: string,
    baseUrl: string,
  ) => Effect.Effect<void, Error>
}

/**
 * Resolves mail configuration from the environment.
 * @param env - Environment to read.
 * @returns Mailer configuration.
 */
export const mailerConfigFromEnv = (
  env: Record<string, string | undefined>,
): MailerConfig => ({
  apiKey: env.RESEND_API_KEY,
  from: env.MAIL_FROM,
  fetchImpl: fetch,
})

/**
 * Builds the mailer for one configuration.
 * @param config - Provider key, sender and fetch implementation.
 * @returns The mailer.
 */
export const makeMailer = (config: MailerConfig): Mailer => ({
  sendMagicLink: (to, token, baseUrl) => {
    const url = signInUrl(baseUrl, token)
    if (config.apiKey === undefined || config.from === undefined) {
      return Effect.logInfo(`magic link for ${to}: ${url}`)
    }
    return Effect.tryPromise({
      try: async () => {
        const response = await config.fetchImpl(resendEndpoint, {
          method: "POST",
          headers: {
            authorization: `Bearer ${config.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            from: config.from,
            to,
            subject: mailSubject,
            text: mailBody(url),
          }),
        })
        if (!response.ok) {
          throw new Error(`mail provider answered ${response.status}`)
        }
      },
      catch: (cause) =>
        cause instanceof Error ? cause : new Error(String(cause)),
    })
  },
})

/**
 * Mailer for the process environment.
 * @returns The mailer.
 */
export const MailerLive: Mailer = makeMailer(mailerConfigFromEnv(process.env))
