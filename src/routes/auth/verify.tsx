/**
 * Sign-in landing page (SPEC §17.5). The link in the mail is the credential, so
 * this page spends it once on mount over the same-origin RPC (the reader cookie
 * rides along) and reports the result in the broadsheet voice.
 */

import { ApiClient } from "@/api/api-client"
import type { SessionInfo } from "@/api/auth-schema"
import { Card } from "@/design-system/components/Card"
import { Heading } from "@/design-system/components/Heading"
import { LinkButton } from "@/design-system/components/LinkButton"
import { Page } from "@/design-system/components/Page"
import { Text } from "@/design-system/components/Text"
import { Stack } from "@/design-system/primitives/Stack"
import { createFileRoute } from "@tanstack/react-router"
import { Effect } from "effect"
import { useEffect, useState } from "react"
import { pageHead } from "../__root"

/**
 * Head entries for the sign-in landing page.
 * @returns Title and description; the page is not indexed.
 */
export const verifyHead = () =>
  pageHead({
    title: "Sign-in · AcademiTok",
    description:
      "Spending an AcademiTok sign-in link so your topics follow you across devices.",
  })

export const Route = createFileRoute("/auth/verify")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: verifyHead,
  component: VerifyPage,
})

/**
 * Spends one token over the RPC; strict-mode double-mounts must not
 * double-spend a single-use credential, so spent tokens are memoised.
 */
const spentTokens = new Set<string>()
const spendSignIn = (token: string): Promise<SessionInfo> =>
  Effect.runPromise(
    Effect
      .gen(function*() {
        const { rpc } = yield* ApiClient
        return yield* rpc.auth_verifySignIn({ token })
      })
      .pipe(Effect.provide(ApiClient.layer)),
  )

type VerifyOutcome =
  | { readonly state: "pending" }
  | { readonly state: "signed"; readonly email: string }
  | { readonly state: "spent" }
  | { readonly state: "failed" }

/**
 * Outcome of spending the link.
 * @returns A single broadsheet notice: signed in, or the link is spent.
 */
function VerifyPage() {
  const { token } = Route.useSearch()
  const [outcome, setOutcome] = useState<VerifyOutcome>(
    token === "" ? { state: "spent" } : { state: "pending" },
  )

  useEffect(() => {
    if (token === "" || spentTokens.has(token)) {
      return
    }
    spentTokens.add(token)
    let cancelled = false
    spendSignIn(token).then(
      (session) => {
        if (!cancelled) {
          setOutcome(
            session.email === null
              ? { state: "spent" }
              : { state: "signed", email: session.email },
          )
        }
      },
      () => {
        if (!cancelled) {
          setOutcome({ state: "failed" })
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <Page>
      <Card tone="subtle">
        <Stack gap="m">
          <Text tone="label" as="span">
            {outcome.state === "signed" ? "Signed in" : "Sign-in"}
          </Text>
          <Heading as="h1" tone="page">
            {outcome.state === "signed"
              ? "Your desk travels with you."
              : outcome.state === "failed"
              ? "That request did not go through."
              : outcome.state === "pending"
              ? "Spending the link…"
              : "That link is spent."}
          </Heading>
          <Text tone="muted">
            {outcome.state === "signed"
              ? `This browser now keeps the topics and clippings of ${outcome.email}. Open the desk on another device and ask for a link there to fold it in.`
              : outcome.state === "failed"
              ? "Check the address and try again, or ask for a fresh link from the papers."
              : outcome.state === "pending"
              ? "One moment while the link is spent."
              : "Sign-in links work once and expire in 15 minutes. Ask for a fresh one from the papers."}
          </Text>
          <LinkButton href="/" target="_self">
            Back to the papers
          </LinkButton>
        </Stack>
      </Card>
    </Page>
  )
}
