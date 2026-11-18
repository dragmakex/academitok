/**
 * Sign-in landing page (SPEC §17.5). The link in the mail is the credential, so
 * this route spends it on load and reports the result in the broadsheet voice.
 */

import { Card } from "@/design-system/components/Card"
import { Heading } from "@/design-system/components/Heading"
import { LinkButton } from "@/design-system/components/LinkButton"
import { Page } from "@/design-system/components/Page"
import { Text } from "@/design-system/components/Text"
import { Stack } from "@/design-system/primitives/Stack"
import { createFileRoute } from "@tanstack/react-router"
import { verifySignInFn } from "../-lib/session-functions"
import { pageHead } from "../__root"

/**
 * Head entries for the sign-in landing page.
 * @returns Title and description; the page is not indexed.
 */
export const verifyHead = () =>
  pageHead({
    title: "Sign-in · AcademiTok",
    description:
      "Spending an AcademiTok sign-in link so one reading desk follows the reader across devices.",
  })

export const Route = createFileRoute("/auth/verify")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  loaderDeps: ({ search }) => ({ token: search.token }),
  loader: ({ deps }) => verifySignInFn({ data: { token: deps.token } }),
  head: verifyHead,
  component: VerifyPage,
})

/**
 * Outcome of spending the link.
 * @returns A single broadsheet notice: signed in, or the link is spent.
 */
function VerifyPage() {
  const { email } = Route.useLoaderData()

  return (
    <Page>
      <Card tone="subtle">
        <Stack gap="m">
          <Text tone="label" as="span">
            {email === null ? "Sign-in" : "Signed in"}
          </Text>
          <Heading as="h1" tone="page">
            {email === null
              ? "That link is spent."
              : "Your desk travels with you."}
          </Heading>
          <Text tone="muted">
            {email === null
              ? "Sign-in links work once and expire in 15 minutes. Ask for a fresh one from the reading desk."
              : `This browser now keeps the topics and clippings of ${email}. Open the desk on another device and ask for a link there to fold it in.`}
          </Text>
          <LinkButton href="/" target="_self">
            Back to the deck
          </LinkButton>
        </Stack>
      </Card>
    </Page>
  )
}
