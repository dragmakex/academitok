/**
 * Design system component registry.
 *
 * Every primitive and component in the design system must be registered here
 * with a justification for its existence. The design-system linter verifies
 * that no unregistered files exist under `src/design-system/`.
 *
 * Before adding a new entry, apply the decision framework in
 * `docs/design-system/rules.md` § "Should this be a component?".
 *
 * @see docs/design-system/rules.md
 */
export const registry = {
  foundation: {
    "foundation/classes.ts":
      "cx() class joiner — shared utility for DS internals",
    "foundation/tokens.ts":
      "Typed spacing scale mapping to Tailwind @theme classes",
    "foundation/useFocusTrap.ts":
      "Focus trap hook — shared by every modal surface so keyboard dismissal and focus restore cannot drift",
  },

  primitives: {
    "primitives/Stack.tsx":
      "Vertical flex layout — core building block for all vertical composition",
    "primitives/Inline.tsx":
      "Horizontal flex layout — core building block for all horizontal composition",
    "primitives/Grid.tsx":
      "Named responsive grid layouts — cannot be expressed by Stack/Inline",
    "primitives/Expand.tsx":
      "Flex-grow child — enables fluid layouts inside Inline/Stack",
    "primitives/Surface.tsx":
      "Semantic background/border/shadow — visual tone system",
  },

  components: {
    "components/Page.tsx":
      "Full-page wrapper — page-level constraints used by every route",
    "components/Card.tsx":
      "Padded surface — used everywhere for content sections",
    "components/Button.tsx":
      "Interactive control — replaces all native buttons in app code",
    "components/LinkButton.tsx":
      "Interactive anchor control — replaces styled links in app code",
    "components/Heading.tsx":
      "Semantic typography — three heading roles (page/section/card)",
    "components/Text.tsx":
      "Semantic typography — five text roles (body/muted/label/caption/danger)",
    "components/Badge.tsx": "Compact status indicator — semantic tone system",
    "components/TextField.tsx":
      "Labeled input — replaces all native text inputs in app code",
    "components/Checkbox.tsx":
      "Labeled checkbox — replaces all native checkboxes in app code",
    "components/Tabs.tsx": "Tab list — interactive segmented view with counts",
    "components/PageHeader.tsx":
      "Composed pattern — title + description + actions, used by every page",
    "components/StatCard.tsx":
      "Composed pattern — dashboard metric card with label/value/helper",
    "components/EmptyState.tsx":
      "State pattern — required for every data surface",
    "components/ErrorState.tsx":
      "State pattern — required for every data surface",
    "components/EdgeDrawer.tsx":
      "Off-canvas control surface — reusable swipe-in drawer for dense filter controls",
    "components/FeedDeck.tsx":
      "Scrollable snap container — reusable short-form feed viewport pattern",
    "components/FeedStateSlide.tsx":
      "Fullscreen feed state wrapper — centers loading, empty, and error states inside the snap feed",
    "components/NewsprintField.tsx":
      "Texture primitive — the blurred newsprint the deck is printed on, shared so the nameplate band and the page field cannot drift",
    "components/Masthead.tsx":
      "Nameplate band — shared by the deck, the permalink, and the morgue file so the folio line and wordmark cannot drift",
    "components/PaperSlide.tsx":
      "Complex feed surface — short-form paper card with action rail and metadata",
    "components/PaperPage.tsx":
      "Canonical permalink surface — full broadsheet clipping with citation copy",
    "components/CopyBlock.tsx":
      "Quoted plain-text block with clipboard control and polite status — shared by the citation and edition notices so the copy pattern cannot drift",
    "components/Notice.tsx":
      "Transient notice line — save confirmation and undoable hide, fixed above the deck's bottom inset",
    "components/ShortcutSheet.tsx":
      "Keyboard reference sheet — focus-trapped key/action list rendered from the deck binding table",
  },
} as const

/**
 * All registered file paths relative to `src/design-system/`.
 */
export const registeredPaths: ReadonlyArray<string> = [
  ...Object.keys(registry.foundation),
  ...Object.keys(registry.primitives),
  ...Object.keys(registry.components),
  "registry.ts",
]
