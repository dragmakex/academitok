import { Atom } from "@effect-atom/atom-react"
import type * as Schema from "effect/Schema"

export interface TypedSerializable<A, I> {
  readonly [Atom.SerializableTypeId]: {
    readonly key: string
    readonly encode: (value: A) => I
    readonly decode: (value: I) => A
  }
}

export const serializable: {
  <R extends Atom.Atom<unknown>, I>(options: {
    readonly key: string
    readonly schema: Schema.Schema<Atom.Type<R>, I>
  }): (self: R) => R & TypedSerializable<Atom.Type<R>, I>
  <R extends Atom.Atom<unknown>, I>(
    self: R,
    options: {
      readonly key: string
      readonly schema: Schema.Schema<Atom.Type<R>, I>
    },
  ): R & TypedSerializable<Atom.Type<R>, I>
} = Atom.serializable as typeof serializable

export interface DehydratedAtom {
  readonly "~@effect-atom/atom/DehydratedAtom": true
  readonly key: string
  readonly value: object
  readonly dehydratedAt: number
}

export const dehydrate = <A, I>(
  atom: Atom.Atom<A> & TypedSerializable<A, I>,
  value: A,
): DehydratedAtom => ({
  "~@effect-atom/atom/DehydratedAtom": true,
  key: atom[Atom.SerializableTypeId].key,
  value: atom[Atom.SerializableTypeId].encode(value) as object,
  dehydratedAt: Date.now(),
})
