# Design System Rules

## Intent

These rules are the hard policy for UI work.
Violations are build failures, not style preferences.

## Enforcement model

**Components are the boundary.**

Design-system primitives and components expose typed props.
They do not expose `className`.
Application code composes them — it does not style anything.

Tailwind CSS is an internal tool of the design-system layer.
Application code never touches Tailwind utilities directly.

## Required rules

### 1. Compose, do not wrap

Use the existing primitives (`Stack`, `Inline`, `Grid`, `Expand`) and components to build layouts.

**Do not create thin wrapper components for layout patterns.**
A sidebar is `Stack gap="l"`, not a `SidebarStack` component.
A group header is `Inline align="between"`, not a `GroupHeader` component.

If you find yourself creating a component that is just a div with fixed Tailwind classes,
you are doing it wrong. Compose primitives instead.

### 2. Use design-system components for semantic UI

For interactive and semantic elements, use components from `src/design-system/**`:

- `Button` instead of a styled `<button>`
- `TextField` instead of a styled `<input>`
- `Card`, `Badge`, `Tabs`, `EmptyState`, `ErrorState` for surfaces and patterns

### 3. No className in application code

Application code must not use the `className` attribute.
All visual styling flows through design-system component props.

### 4. No inline style in application code

Application code must not use the `style` attribute.

### 5. No route-local styled native controls

Do not style native `<button>`, `<input>`, `<select>`, or `<textarea>` elements in application code.
Use design-system wrappers.

### 6. Routes compose; design-system styles

Route and feature components compose structure and data flow.
Visual implementation belongs in the design-system layer.

## Exceptions

Exceptions are allowed only when:

1. The design-system cannot reasonably support the use case yet.
2. The exception is local and explicit.
3. The exception includes a reason.

```tsx
// ds-exception: third-party widget requires inline width measurement
```

Silent bypasses are not allowed.
Exceptions without a reason are treated as violations.
