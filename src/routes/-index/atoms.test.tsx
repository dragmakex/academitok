import type { FeedItem } from "@/api/paper-schema"
import { curatedPapers } from "@/data/papers"
import { Notice } from "@/design-system/components/Notice"
import { reactionFailureNotice } from "@/lib/feed-analytics"
import type { RemovedItem } from "@/lib/feed-items"
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import { expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import { page } from "vitest/browser"
import {
  reactionFailureAtom,
  reactToPaperAtom,
  removeSavedPaperAtom,
  restoreHiddenPaperAtom,
} from "./atoms"

const { rpc } = vi.hoisted(() => ({ rpc: { refuse: true } }))

vi.mock("@/api/api-client", async () => {
  const Context = await import("effect/Context")
  const Effect = await import("effect/Effect")
  const Layer = await import("effect/Layer")
  const answer = () =>
    rpc.refuse
      ? Effect.fail(new Error("refused"))
      : Effect.succeed({ paperId: "p", kind: "like", active: true })
  const api = {
    rpc: {
      papers_snapshot: answer,
      papers_saveProfile: answer,
      profile_onboard: answer,
      papers_react: answer,
      papers_trackViews: answer,
      papers_savedList: answer,
    },
  }
  const ApiClient = Context.Service<typeof api>("ApiClient")
  return {
    ApiClient: Object.assign(ApiClient, {
      layer: Layer.succeed(ApiClient)(api),
    }),
  }
})

const settled = async (
  registry: AtomRegistry.AtomRegistry,
  atom: typeof reactToPaperAtom,
) => {
  await vi.waitFor(() => expect(registry.get(atom)._tag).not.toBe("Initial"))
}

test("a refused reaction records the kind the desk never received", async () => {
  rpc.refuse = true
  const registry = AtomRegistry.make()

  registry.set(reactToPaperAtom, { kind: "like", paperId: "p" })
  await settled(registry, reactToPaperAtom)
  expect(registry.get(reactionFailureAtom)).toBe("like")

  registry.set(reactionFailureAtom, null)
  registry.set(removeSavedPaperAtom, "p")
  await vi.waitFor(() =>
    expect(registry.get(reactionFailureAtom)).toBe("bookmark")
  )

  registry.set(reactionFailureAtom, null)
  const removed: RemovedItem<FeedItem> = {
    item: {
      paper: curatedPapers[0],
      score: 0,
      rationale: [],
      accessible: true,
      liked: false,
      bookmarked: false,
      hidden: false,
      exploration: false,
      again: false,
    },
    index: 0,
  }
  registry.set(restoreHiddenPaperAtom, removed)
  await vi.waitFor(() => expect(registry.get(reactionFailureAtom)).toBe("hide"))
})

test("a successful reaction records no failure", async () => {
  rpc.refuse = false
  const registry = AtomRegistry.make()

  registry.set(reactToPaperAtom, { kind: "bookmark", paperId: "p" })
  await settled(registry, reactToPaperAtom)
  expect(registry.get(reactionFailureAtom)).toBeNull()
})

test("the refusal is announced as a status line with no action", async () => {
  await render(<Notice label={reactionFailureNotice("hide")} />)

  await expect.element(page.getByRole("status")).toHaveTextContent(
    "Could not hide the clipping",
  )
  expect(document.querySelector("button")).toBeNull()
})
