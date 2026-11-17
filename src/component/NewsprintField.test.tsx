import { NewsprintField } from "@/design-system/components/NewsprintField"
import { registry } from "@/design-system/registry"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, test } from "vitest"

test("the desktop field is one blurred broadsheet, never a tiled pattern", () => {
  const html = renderToStaticMarkup(<NewsprintField variant="page" />)

  expect(html).toContain("newsprint.svg")
  expect(html).toContain("bg-cover")
  expect(html).toContain("bg-no-repeat")
  expect(html).not.toContain("bg-repeat")
  expect(html).toContain("blur-")
  expect(html).toContain("aria-hidden=\"true\"")
})

test("the nameplate band is the same page, held sharper", () => {
  const html = renderToStaticMarkup(<NewsprintField variant="band" />)

  expect(html).toContain("newsprint.svg")
  expect(html).toContain("bg-cover")
})

test("the field is registered so the design system cannot drift", () => {
  expect(registry.components["components/NewsprintField.tsx"]).toBeDefined()
})
