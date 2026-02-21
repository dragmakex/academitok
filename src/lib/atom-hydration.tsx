"use client"

import { RegistryContext } from "@effect/atom-react"
import * as Arr from "effect/Array"
import * as Atom from "effect/unstable/reactivity/Atom"
import * as React from "react"
import type { DehydratedAtom } from "./atom-utils"

export type HydrationBoundaryProps = {
  readonly children: React.ReactNode
  readonly state?: Iterable<DehydratedAtom> | undefined
}

/**
 * Hydrates serializable atoms into the current registry before rendering children.
 *
 * @param props - Hydration boundary props.
 * @param props.children - Content to render after hydration.
 * @param props.state - Dehydrated atom payloads.
 * @returns The hydrated subtree.
 */
export const HydrationBoundary = (
  { children, state }: HydrationBoundaryProps,
) => {
  const registry = React.useContext(RegistryContext)

  React.useMemo(() => {
    if (!state) {
      return
    }

    const incoming = Arr.fromIterable(state)
    const nodes = registry.getNodes()

    for (const dehydratedAtom of incoming) {
      registry.setSerializable(dehydratedAtom.key, dehydratedAtom.value)

      const existingNode = nodes.get(dehydratedAtom.key)
      if (!existingNode) {
        continue
      }

      const atom = existingNode.atom
      if (!(Atom.SerializableTypeId in atom)) {
        continue
      }

      const serializable = atom[Atom.SerializableTypeId] as {
        readonly decode: (value: unknown) => unknown
      }
      const decoded = serializable.decode(dehydratedAtom.value)
      const nodeWithSetter = existingNode as {
        readonly setValue?: (value: unknown) => void
      }
      if (typeof nodeWithSetter.setValue === "function") {
        nodeWithSetter.setValue(decoded)
      }
    }
  }, [registry, state])

  return (
    <>
      {children}
    </>
  )
}
