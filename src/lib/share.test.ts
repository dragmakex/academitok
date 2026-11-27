import { appShare, paperShare, sharePayload } from "@/lib/share"
import type { ShareHost } from "@/lib/share"
import { describe, expect, it, vi } from "vitest"

const host = (overrides: Partial<ShareHost> = {}): ShareHost => ({
  clipboard: { writeText: vi.fn(async () => undefined) },
  ...overrides,
})

const paper = {
  authors: "Leah Ortiz",
  permalink: "https://academitok.example/paper/pmc-1",
  title: "Attention Maps for Agents",
  year: 2025,
}

describe("share payloads", () => {
  it("offers the app, not the ten papers behind it", () => {
    const app = appShare("https://academitok.example")

    expect(app.title).toBe("AcademiTok")
    expect(app.url).toBe("https://academitok.example")
    expect(app.text).not.toContain("Folio")
  })

  it("offers one paper with its byline and permalink", () => {
    const one = paperShare(paper)

    expect(one.title).toBe(paper.title)
    expect(one.text).toBe(
      "Attention Maps for Agents — Leah Ortiz (2025) · Found on AcademiTok",
    )
    expect(one.url).toBe(paper.permalink)
  })
})

describe("sharePayload", () => {
  it("hands the share sheet the payload and copies nothing", async () => {
    const share = vi.fn(async () => undefined)
    const clipboard = { writeText: vi.fn(async () => undefined) }

    await expect(sharePayload(paperShare(paper), host({ clipboard, share })))
      .resolves
      .toBe("shared")
    expect(share).toHaveBeenCalledWith(paperShare(paper))
    expect(clipboard.writeText).not.toHaveBeenCalled()
  })

  it("copies the link when the platform has no share sheet", async () => {
    const clipboard = { writeText: vi.fn(async () => undefined) }

    await expect(sharePayload(paperShare(paper), host({ clipboard })))
      .resolves
      .toBe("copied")
    expect(clipboard.writeText).toHaveBeenCalledWith(paper.permalink)
  })

  it("copies the link when the share sheet fails for another reason", async () => {
    const share = vi.fn(async () => {
      throw new Error("no handler")
    })

    await expect(sharePayload(paperShare(paper), host({ share })))
      .resolves
      .toBe("copied")
  })

  it("says nothing when the reader dismisses the sheet", async () => {
    const share = vi.fn(async () => {
      const abort = new Error("cancelled")
      abort.name = "AbortError"
      throw abort
    })

    await expect(sharePayload(paperShare(paper), host({ share })))
      .resolves
      .toBe("dismissed")
  })

  it("reports a failure when the clipboard is denied too", async () => {
    const clipboard = {
      writeText: vi.fn(async () => {
        throw new Error("denied")
      }),
    }

    await expect(sharePayload(paperShare(paper), host({ clipboard })))
      .resolves
      .toBe("failed")
  })
})
