import { RegistryContext } from "@effect/atom-react"
import { expect, test, vi } from "vitest"
import { render } from "vitest-browser-react"
import * as Atom from "effect/unstable/reactivity/Atom"
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import { HydrationBoundary } from "./atom-hydration"
import type { DehydratedAtom } from "./atom-utils"

/**
 * Tests for atom-hydration.tsx - ensures dehydrated atoms are queued and applied.
 */

test("HydrationBoundary hydrates new and existing atoms", async () => {
  const registry = AtomRegistry.make()
  const setSerializable = vi.spyOn(registry, "setSerializable")
  const existingAtom = Atom.make(0)
  const existingNode = { atom: existingAtom, value: () => 0 }
  registry.getNodes().set("existing-key", existingNode)

  const state: DehydratedAtom[] = [
    {
      "~@effect-atom/atom/DehydratedAtom": true,
      key: "existing-key",
      value: { count: 1 },
      dehydratedAt: 1,
    },
    {
      "~@effect-atom/atom/DehydratedAtom": true,
      key: "new-key",
      value: { count: 2 },
      dehydratedAt: 2,
    },
  ]

  await render(
    <RegistryContext.Provider value={registry}>
      <HydrationBoundary state={state}>
        <div data-testid="hydration-child" />
      </HydrationBoundary>
    </RegistryContext.Provider>,
  )

  await new Promise((resolve) => setTimeout(resolve, 0))

  expect(setSerializable).toHaveBeenCalledWith("new-key", { count: 2 })
  expect(setSerializable).toHaveBeenCalledWith("existing-key", { count: 1 })
  expect(setSerializable).toHaveBeenCalledTimes(2)
})

test("HydrationBoundary skips when state is undefined", async () => {
  const registry = AtomRegistry.make()
  const setSerializable = vi.spyOn(registry, "setSerializable")

  await render(
    <RegistryContext.Provider value={registry}>
      <HydrationBoundary>
        <div data-testid="hydration-empty" />
      </HydrationBoundary>
    </RegistryContext.Provider>,
  )

  await new Promise((resolve) => setTimeout(resolve, 0))

  expect(setSerializable).not.toHaveBeenCalled()
})
