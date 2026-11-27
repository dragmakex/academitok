/**
 * Sign-out (SPEC §17.5): hands the browser a fresh anonymous reader and sends
 * it back to the deck. The account keeps the old reader, so signing in again
 * on this device folds this browser back in.
 */

import { sessionReaderCookie } from "@/lib/reader-id"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/auth/sign-out")({
  server: {
    handlers: {
      GET: () =>
        new Response(null, {
          status: 303,
          headers: { location: "/", "set-cookie": sessionReaderCookie() },
        }),
    },
  },
})
