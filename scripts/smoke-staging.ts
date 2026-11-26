#!/usr/bin/env bun

/**
 * End-to-end staging smoke test.
 *
 * Verifies HTTP liveness/readiness, removed debug endpoints, SSR + hydration,
 * onboarding, like/save persistence, `/saved` morgue, BibTeX exports, and
 * `/paper/$id` permalinks against a live running server.
 *
 * Usage:
 * BASE_URL=http://127.0.0.1:3109 bun run smoke:staging
 */

import { chromium } from "playwright"

const baseUrl = (process.env.BASE_URL ?? "http://127.0.0.1:3000").replace(
  /\/+$/,
  "",
)

/**
 * Asserts a boolean condition with a clear error message.
 * @param condition - Condition that must hold.
 * @param message - Diagnostic message on failure.
 */
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Smoke test assertion failed: ${message}`)
  }
}

/**
 * Verifies API health, database readiness, and removed Sentry test routes.
 */
async function checkApiContracts(): Promise<void> {
  const health = await fetch(`${baseUrl}/api/health`)
  assert(health.status === 200, `GET /api/health returned ${health.status}`)
  assert(
    (await health.text()) === "OK",
    "GET /api/health body was not OK",
  )

  const ready = await fetch(`${baseUrl}/api/ready`)
  assert(ready.status === 200, `GET /api/ready returned ${ready.status}`)
  assert((await ready.text()) === "OK", "GET /api/ready body was not OK")

  const sentryGet = await fetch(`${baseUrl}/api/sentry-test`)
  assert(
    sentryGet.status === 404,
    `GET /api/sentry-test returned ${sentryGet.status}, expected 404`,
  )

  const sentryPost = await fetch(`${baseUrl}/api/sentry-test`, {
    method: "POST",
  })
  assert(
    sentryPost.status === 404,
    `POST /api/sentry-test returned ${sentryPost.status}, expected 404`,
  )

  console.log(
    "  ✓ API health, DB readiness (/api/ready), and 404 /api/sentry-test",
  )
}

/**
 * Drives the full reader journey in headless Chromium against the live server.
 */
async function checkBrowserJourney(): Promise<void> {
  const browser = await chromium.launch({ headless: true })
  const pageErrors: Array<string> = []

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    })
    const page = await context.newPage()
    page.on("pageerror", (error) => {
      pageErrors.push(error.message)
    })

    const homeResponse = await page.goto(`${baseUrl}/`, {
      waitUntil: "networkidle",
    })
    assert(
      homeResponse !== null && homeResponse.status() === 200,
      `GET / returned ${homeResponse?.status() ?? "null"}`,
    )

    const cookies = await context.cookies(baseUrl)
    const readerCookie = cookies.find((cookie) =>
      cookie.name === "academitok_reader_id"
    )
    assert(
      readerCookie !== undefined && readerCookie.httpOnly,
      "academitok_reader_id HttpOnly cookie was not minted on GET /",
    )

    const skipButton = page.getByRole("button", { name: "Skip this" })
    if (await skipButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await skipButton.click()
    }

    const firstArticle = page.locator("article").first()
    await firstArticle.waitFor({ state: "visible", timeout: 15_000 })
    const headline = await firstArticle.locator("h2").first().innerText()
    assert(headline.trim().length > 0, "First clipping headline was empty")

    const likeButton = firstArticle.getByRole("button", { name: "Like paper" })
    await likeButton.click()
    await firstArticle
      .getByRole("button", { name: "Unlike paper" })
      .waitFor({ state: "visible", timeout: 10_000 })

    const saveButton = firstArticle.getByRole("button", { name: "Save paper" })
    await saveButton.click()
    await firstArticle
      .getByRole("button", { name: "Remove saved paper" })
      .waitFor({ state: "visible", timeout: 10_000 })
    console.log(`  ✓ Deck loaded, liked, and saved: "${headline.trim()}"`)

    const savedResponse = await page.goto(`${baseUrl}/saved`, {
      waitUntil: "networkidle",
    })
    assert(
      savedResponse !== null && savedResponse.status() === 200,
      `GET /saved returned ${savedResponse?.status() ?? "null"}`,
    )

    const savedLink = page.locator("article h2 a[href^=\"/paper/\"]").first()
    await savedLink.waitFor({ state: "visible", timeout: 10_000 })
    const savedTitle = (await savedLink.innerText()).trim()
    const paperHref = await savedLink.getAttribute("href")
    assert(
      savedTitle === headline.trim(),
      `Saved clipping title "${savedTitle}" did not match "${headline.trim()}"`,
    )
    assert(
      paperHref !== null && paperHref.startsWith("/paper/"),
      "Missing /paper/ link",
    )
    console.log("  ✓ Saved clipping persisted to /saved")

    const savedBib = await page.evaluate(async () => {
      const response = await fetch("/api/saved.bib")
      return {
        status: response.status,
        contentType: response.headers.get("content-type"),
        body: await response.text(),
      }
    })
    assert(
      savedBib.status === 200,
      `/api/saved.bib returned ${savedBib.status}`,
    )
    assert(
      savedBib.contentType?.includes("application/x-bibtex") === true,
      `Unexpected /api/saved.bib content-type: ${savedBib.contentType}`,
    )
    assert(
      savedBib.body.includes("@article{"),
      "/api/saved.bib did not contain a BibTeX @article entry",
    )
    console.log("  ✓ /api/saved.bib returned persisted BibTeX export")

    const paperResponse = await page.goto(`${baseUrl}${paperHref}`, {
      waitUntil: "networkidle",
    })
    assert(
      paperResponse !== null && paperResponse.status() === 200,
      `GET ${paperHref} returned ${paperResponse?.status() ?? "null"}`,
    )
    await page.locator("h1").first().waitFor({
      state: "visible",
      timeout: 10_000,
    })

    const paperId = decodeURIComponent(paperHref.slice("/paper/".length))
    const paperBib = await fetch(
      `${baseUrl}/api/paper.bib?id=${encodeURIComponent(paperId)}`,
    )
    assert(
      paperBib.status === 200,
      `/api/paper.bib returned ${paperBib.status}`,
    )
    assert(
      (await paperBib.text()).includes("@article{"),
      "/api/paper.bib did not return a BibTeX entry",
    )
    console.log(`  ✓ Permalink ${paperHref} and /api/paper.bib verified`)

    assert(
      pageErrors.length === 0,
      `Uncaught browser page errors: ${pageErrors.join("; ")}`,
    )
  } finally {
    await browser.close()
  }
}

/**
 * Entry point for the staging smoke suite.
 */
async function main(): Promise<void> {
  console.log(`Running staging E2E smoke test against ${baseUrl}...`)
  await checkApiContracts()
  await checkBrowserJourney()
  console.log("✅ Staging E2E smoke test passed!")
}

await main()
