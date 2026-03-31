# Design System Tokens

## Intent

Tokens express the visual language semantically.
They are declared in the `@theme` block of `src/styles.css` and consumed via Tailwind utilities inside design-system components.

Application code never references tokens directly.
It uses component props like `tone`, `gap`, and `variant` which map to the right tokens internally.

## Color roles

Semantic color tokens available as Tailwind classes (e.g. `bg-bg-surface`, `text-text-primary`):

- `--color-bg-canvas` — page background
- `--color-bg-surface` — card and panel background
- `--color-bg-subtle` — secondary surface background
- `--color-bg-accent` — accent-tinted background
- `--color-bg-danger` — danger-tinted background
- `--color-bg-success` — success-tinted background
- `--color-text-primary` — primary text
- `--color-text-secondary` — secondary text
- `--color-text-muted` — muted text
- `--color-text-on-accent` — text on accent surfaces
- `--color-border-default` — standard border
- `--color-border-strong` — emphasized border
- `--color-border-danger` — danger border
- `--color-accent-solid` — primary accent
- `--color-danger-solid` — danger accent
- `--color-success-solid` — success accent
- `--color-accent-wash` — light accent wash
- `--color-success-wash` — light success wash
- `--color-danger-wash` — light danger wash
- `--color-focus-ring` — focus indicator

## Spacing scale

Semantic spacing tokens available as Tailwind classes (e.g. `gap-m`, `p-l`, `px-xs`):

- `--spacing-2xs` — 0.25rem
- `--spacing-xs` — 0.5rem
- `--spacing-s` — 0.75rem
- `--spacing-m` — 1rem
- `--spacing-l` — 1.5rem
- `--spacing-xl` — 2rem
- `--spacing-2xl` — 3rem

These map to layout rhythm, not arbitrary pixel values.

## Radius and elevation

- `--radius-sm` — 0.5rem
- `--radius-md` — 0.875rem
- `--radius-lg` — 1.25rem
- `--shadow-sm` — subtle elevation
- `--shadow-md` — prominent elevation

## Dark mode

Dark mode overrides are handled via `prefers-color-scheme` in `styles.css`.
The same token names resolve to dark values automatically.
Design-system components do not need dark mode logic.

## Typography roles

Typography is expressed through component props:

- `Heading tone="page"` — page title
- `Heading tone="section"` — section title
- `Heading tone="card"` — card title
- `Text tone="body"` — body text
- `Text tone="muted"` — de-emphasized text
- `Text tone="label"` — field labels
- `Text tone="caption"` — small helper text
- `Text tone="danger"` — error text
