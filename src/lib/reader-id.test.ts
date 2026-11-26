import {
  defaultReaderId,
  newReaderId,
  readerCookie,
  ReaderId,
  readerIdCookieName,
  readerIdFromCookieHeader,
} from "@/lib/reader-id"
import { describe, expect, it } from "vitest"

const readerId = "0f8c7f4e-1c3e-4f22-9a1a-9b4b1c0a1d11"

describe("reader id", () => {
  it("names the cookie and the fallback reader", () => {
    expect(readerIdCookieName).toBe("academitok_reader_id")
    expect(defaultReaderId).toBe("singleton")
    expect(ReaderId.key).toBe("ReaderId")
  })

  it("reads a valid id from the cookie header", () => {
    expect(readerIdFromCookieHeader(`${readerIdCookieName}=${readerId}`))
      .toBe(readerId)
    expect(
      readerIdFromCookieHeader(
        `theme=dark; ${readerIdCookieName}=${readerId}; lang=en`,
      ),
    )
      .toBe(readerId)
  })

  it("ignores missing, malformed and too-long values", () => {
    expect(readerIdFromCookieHeader(undefined)).toBe(defaultReaderId)
    expect(readerIdFromCookieHeader("theme=dark")).toBe(defaultReaderId)
    expect(readerIdFromCookieHeader(`${readerIdCookieName}=short`))
      .toBe(defaultReaderId)
    expect(readerIdFromCookieHeader(`${readerIdCookieName}=drop;table`))
      .toBe(defaultReaderId)
    expect(readerIdFromCookieHeader(`${readerIdCookieName}=${"a".repeat(65)}`))
      .toBe(defaultReaderId)
  })

  it("mints ids the cookie grammar accepts", () => {
    const minted = newReaderId()
    expect(readerIdFromCookieHeader(`${readerIdCookieName}=${minted}`))
      .toBe(minted)
    expect(newReaderId()).not.toBe(minted)
  })

  it("hardens the reader cookie for production", () => {
    const hardened = readerCookie(readerId, { httpOnly: true, secure: true })
    expect(hardened).toContain(`${readerIdCookieName}=${readerId}`)
    expect(hardened).toContain("Path=/")
    expect(hardened).toContain("Max-Age=31536000")
    expect(hardened).toContain("SameSite=Lax")
    expect(hardened).toContain("HttpOnly")
    expect(hardened).toContain("Secure")
  })

  it("leaves the cookie script-visible while the reader is anonymous", () => {
    const plain = readerCookie(readerId, { httpOnly: false, secure: false })
    expect(plain).not.toContain("HttpOnly")
    expect(plain).not.toContain("Secure")
  })

  it("reads the minted cookie back as the reader id", () => {
    const minted = newReaderId()
    const header = `${readerIdCookieName}=${minted}; another=1`
    expect(readerIdFromCookieHeader(header)).toBe(minted)
    expect(readerIdFromCookieHeader(`${readerIdCookieName}=short`)).toBe(
      defaultReaderId,
    )
  })
})
