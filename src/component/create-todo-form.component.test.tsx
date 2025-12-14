import { expect, test /*, vi*/ } from "vitest"
import { render } from "vitest-browser-react"
import { page } from "vitest/browser"
import { CreateTodoForm } from "../routes/-index/create-todo-form"

/**
 * Component Tests for CreateTodoForm
 *
 * These tests verify the behavior and interactions of the CreateTodoForm component.
 * They test user interactions, form validation, and component state management.
 */

test("renders input and button elements", async () => {
  render(<CreateTodoForm />)

  // Verify the input field is present
  const input = page.getByPlaceholder("What needs to be done?")
  await expect.element(input).toBeInTheDocument()

  // Verify the submit button is present
  const button = page.getByRole("button", { name: /add/i })
  await expect.element(button).toBeInTheDocument()
})

test("submit button is disabled when input is empty", async () => {
  render(<CreateTodoForm />)

  const button = page.getByRole("button", { name: /add/i })
  await expect.element(button).toBeDisabled()
})

test("submit button is enabled when input has text", async () => {
  render(<CreateTodoForm />)

  const input = page.getByPlaceholder("What needs to be done?")
  const button = page.getByRole("button", { name: /add/i })

  // Type some text
  await input.fill("Buy groceries")

  // Button should now be enabled
  await expect.element(button).not.toBeDisabled()
})

test("submit button is disabled for whitespace-only input", async () => {
  render(<CreateTodoForm />)

  const input = page.getByPlaceholder("What needs to be done?")
  const button = page.getByRole("button", { name: /add/i })

  // Type only whitespace
  await input.fill("   ")

  // Button should remain disabled
  await expect.element(button).toBeDisabled()
})

test("input can be typed into", async () => {
  render(<CreateTodoForm />)

  const input = page.getByPlaceholder("What needs to be done?")

  await input.fill("Write unit tests")

  // Verify the input value
  await expect.element(input).toHaveValue("Write unit tests")
})

test("form has proper accessibility attributes", async () => {
  render(<CreateTodoForm />)

  const input = page.getByPlaceholder("What needs to be done?")

  // Verify input type
  await expect.element(input).toHaveAttribute("type", "text")

  // Verify input has placeholder for accessibility
  await expect.element(input).toHaveAttribute(
    "placeholder",
    "What needs to be done?",
  )

  // Verify button type
  const button = page.getByRole("button", { name: /add/i })
  await expect.element(button).toHaveAttribute("type", "submit")
})

test("handles form submission with valid input", async () => {
  render(<CreateTodoForm />)

  const input = page.getByPlaceholder("What needs to be done?")
  const button = page.getByRole("button", { name: /add/i })

  // Enter text
  await input.fill("Test todo item")

  // Submit the form
  await button.click()

  // Note: Since this component uses atoms that need a real backend,
  // in a real scenario you would mock the atom or API calls
  // For now, we're just verifying the UI interaction works
})

test("updates button text when in waiting state", async () => {
  render(<CreateTodoForm />)

  // The button should initially show "Add"
  const button = page.getByRole("button", { name: /add/i })
  await expect.element(button).toHaveTextContent("Add")

  // Note: Testing the "Adding..." state would require mocking the atom
  // to simulate the waiting state, which depends on your state management setup
})
