// @vitest-environment node

import type { TrackPaperViewInput } from "@/api/paper-schema"
import { describe, expect, it, vi } from "vitest"
import { bufferImpression, flushImpressionsOnHide } from "./impression-buffer"

const impression = (position: number): TrackPaperViewInput => ({
  paperId: `paper-${position}`,
  kind: "view",
  dwellMs: 0,
  position,
  exploration: false,
})

class VisibilitySource {
  visibilityState: DocumentVisibilityState = "visible"
  readonly listeners = new Set<() => void>()

  /**
   * Registers a visibility listener.
   * @param _type - Visibility event name.
   * @param listener - Event callback.
   */
  addEventListener(_type: "visibilitychange", listener: () => void) {
    this.listeners.add(listener)
  }

  /**
   * Removes a visibility listener.
   * @param _type - Visibility event name.
   * @param listener - Event callback.
   */
  removeEventListener(_type: "visibilitychange", listener: () => void) {
    this.listeners.delete(listener)
  }

  /** Dispatches a visibility change. */
  dispatch() {
    for (const listener of this.listeners) {
      listener()
    }
  }
}

describe("impression buffer", () => {
  it("releases one batch for every ten events", () => {
    let queued: ReadonlyArray<TrackPaperViewInput> = []
    for (let position = 0; position < 9; position += 1) {
      const result = bufferImpression(queued, impression(position), false)
      expect(result.batch).toEqual([])
      queued = result.queued
    }

    const result = bufferImpression(queued, impression(9), false)
    expect(result.batch).toHaveLength(10)
    expect(result.queued).toEqual([])
  })

  it("flushes only when the page becomes hidden and removes its listener", () => {
    const source = new VisibilitySource()
    let batch: ReadonlyArray<TrackPaperViewInput> = []
    const flush = vi.fn(() => {
      batch = bufferImpression([impression(0)], undefined, true).batch
    })
    const cleanup = flushImpressionsOnHide(source, flush)

    source.dispatch()
    expect(flush).not.toHaveBeenCalled()

    source.visibilityState = "hidden"
    source.dispatch()
    expect(flush).toHaveBeenCalledOnce()
    expect(batch).toHaveLength(1)

    cleanup()
    source.dispatch()
    expect(flush).toHaveBeenCalledOnce()
  })
})
