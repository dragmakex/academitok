/**
 * Sign-in server functions (SPEC §17.5): the desk asks for a link, the mail
 * route spends it, and signing out hands the browser a fresh anonymous reader.
 */

import { type SessionInfo, SignInRequestInput } from "@/api/auth-schema"
import {
  readSession,
  requestSignInLink,
  verifySignInLink,
} from "@/features/auth/application"
import { createServerFn } from "@tanstack/react-start"
import * as Schema from "effect/Schema"
import { serverRuntime } from "../api/$"
import { withRequestReader } from "./request-reader"

const tokenInput = Schema.Struct({ token: Schema.String })

/** Reads the account the current reader is signed in to. */
export const readSessionFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionInfo> =>
    serverRuntime.runPromise(withRequestReader(readSession)),
)

/** Mails a sign-in link for an address. */
export const requestSignInFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Schema.decodeUnknownSync(SignInRequestInput)(input)
  )
  .handler(async ({ data }) =>
    serverRuntime.runPromise(withRequestReader(requestSignInLink(data)))
  )

/**
 * Spends a sign-in link. The cookie it binds to was minted by the request
 * boundary, so nothing here rewrites it.
 */
export const verifySignInFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    Schema.decodeUnknownSync(tokenInput)(input)
  )
  .handler(async ({ data }): Promise<SessionInfo> =>
    serverRuntime.runPromise(withRequestReader(verifySignInLink(data.token)))
  )
