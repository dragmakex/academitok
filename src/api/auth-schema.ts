/**
 * Auth contracts (SPEC §17.5): sign-in requests and the reader's session.
 */

import * as Schema from "effect/Schema"

/** Address the reader asked a link for, plus the origin the link must return to. */
export const SignInRequestInput = Schema.Struct({
  email: Schema.String,
  origin: Schema.String,
})
export type SignInRequestInput = typeof SignInRequestInput.Type

/** Whether a link was mailed; false also covers a malformed address. */
export const SignInRequestResult = Schema.Struct({
  sent: Schema.Boolean,
})
export type SignInRequestResult = typeof SignInRequestResult.Type

/** The account a reader is signed in to, if any. */
export const SessionInfo = Schema.Struct({
  email: Schema.NullOr(Schema.String),
})
export type SessionInfo = typeof SessionInfo.Type
