// @vitest-environment node

import {
  isTokenLive,
  magicLinkTtlMs,
  newLinkToken,
  normaliseEmail,
  signInUrl,
  tokenHash,
} from "@/lib/magic-link"
import { describe, expect, it } from "vitest"

describe("magic link tokens", () => {
  it("mints URL-safe tokens that never repeat", () => {
    const minted: Array<string> = []
    for (let index = 0; index < 32; index += 1) {
      minted.push(newLinkToken())
    }
    const tokens = new Set(minted)
    expect(tokens.size).toBe(32)
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  it("stores a digest that does not reveal the token", () => {
    const token = newLinkToken()
    expect(tokenHash(token)).toMatch(/^[0-9a-f]{64}$/)
    expect(tokenHash(token)).not.toContain(token)
    expect(tokenHash(token)).toBe(tokenHash(token))
    expect(tokenHash(token)).not.toBe(tokenHash(newLinkToken()))
  })

  it("normalises addresses and refuses everything else", () => {
    expect(normaliseEmail("  Reader@Example.EDU ")).toBe("reader@example.edu")
    expect(normaliseEmail("reader@example.edu")).toBe("reader@example.edu")
    expect(normaliseEmail("reader@")).toBeNull()
    expect(normaliseEmail("reader@example")).toBeNull()
    expect(normaliseEmail("reader example@edu")).toBeNull()
    expect(normaliseEmail("")).toBeNull()
    expect(normaliseEmail(`${"a".repeat(250)}@example.edu`)).toBeNull()
  })

  it("builds an absolute link on the requesting origin", () => {
    expect(signInUrl("https://academitok.example", "abc")).toBe(
      "https://academitok.example/auth/verify?token=abc",
    )
    expect(signInUrl("https://academitok.example/", "a b")).toBe(
      "https://academitok.example/auth/verify?token=a%20b",
    )
  })

  it("keeps a token live only until it is spent or expires", () => {
    const now = new Date("2026-05-21T10:00:00.000Z")
    const expiresAt = new Date(now.getTime() + magicLinkTtlMs)
    expect(isTokenLive({ expiresAt, consumedAt: null }, now)).toBe(true)
    expect(isTokenLive({ expiresAt, consumedAt: null }, expiresAt)).toBe(false)
    expect(isTokenLive({ expiresAt, consumedAt: now }, now)).toBe(false)
  })
})
