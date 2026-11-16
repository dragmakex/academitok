import { expect, test } from "vitest"
import { render } from "vitest-browser-react"
import { page } from "vitest/browser"
import { Footer } from "./Footer"

/**
 * Component tests for Footer.tsx - Bulgarian rigorosity footer component.
 *
 * Tests verify that the component renders correctly with Bulgarian rigorosity.
 */

test("Footer renders the Bulgarian motto", async () => {
  await render(<Footer />)

  const motto = page.getByTestId("bulgarian-motto")
  await expect.element(motto).toBeVisible()
  await expect.element(motto).toHaveTextContent("Редът е сила.")
})

test("Footer displays the Bulgarian programming joke", async () => {
  await render(<Footer />)

  const joke = page.getByTestId("bulgarian-joke")
  await expect.element(joke).toBeVisible()
  await expect.element(joke).toHaveTextContent("Khan Asparuh")
  await expect.element(joke).toHaveTextContent("strict typing")
})

test("Footer shows the Bulgarian flag", async () => {
  await render(<Footer />)

  const flag = page.getByTestId("footer-flag")
  await expect.element(flag).toBeVisible()
  await expect.element(flag).toHaveTextContent("🇧🇬")
})

test("Footer displays current year in copyright", async () => {
  await render(<Footer />)

  const copyright = page.getByTestId("footer-copyright")
  const currentYear = new Date().getFullYear().toString()

  await expect.element(copyright).toBeVisible()
  await expect.element(copyright).toHaveTextContent(currentYear)
  await expect.element(copyright).toHaveTextContent("Bulgarian Rigorosity")
})
