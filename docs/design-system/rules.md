# Design System Rules

## Intent

These rules are the hard policy for UI work.
Violations are build failures, not style preferences.

## Enforcement model

**Components are the boundary.**

Design-system components expose typed props.
They do not expose `className`.
Application code composes them — it does not style anything.

Tailwind CSS is an internal tool of the design-system layer.
Application code never touches Tailwind utilities directly.

## Required rules

### 1. Use design-system components first

For application UI, use components from `src/design-system/**`.
Do not write route-local markup with styling.

Examples:

- `Button` instead of a styled `<button>`
- `TextField` instead of a styled `<input>`
- `Stack`, `Inline` instead of flexbox divs
- `PageShell`, `PageContent`, `DashboardGrid` for layout
- `StatCard`, `Card`, `Tabs`, `PageHeader`, `EmptyState`, `ErrorState` for surfaces

### 2. No className in application code

Application code must not use the `className` attribute.
All visual styling flows through design-system component props.

### 3. No inline style in application code

Application code must not use the `style` attribute.

### 4. No route-local styled native controls

Do not style native `<button>`, `<input>`, `<select>`, or `<textarea>` elements in application code.
Use design-system wrappers.

### 5. Routes compose; design-system styles

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
