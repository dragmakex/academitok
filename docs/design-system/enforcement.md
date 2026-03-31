# Design System Enforcement

## Intent

The design system is enforced by architecture and tooling.
Components that don't expose `className` make violations structurally impossible.
The linter catches the remaining surface: raw `className`, `style`, and styled native elements in application code.

## Commands

```bash
bun run lint:design-system
bun run lint:design-system:staged
bun run lint:design-system:changed
```

`lint:design-system:changed` compares the current branch against the remote default branch when available, with fallbacks for repositories using `main` or `master`.

## Scope

Current enforcement targets product UI files in:

- `src/routes/**`
- `src/component/**`

The design-system implementation under `src/design-system/**` uses Tailwind utilities freely.

## What is enforced

### Structural (type system)

Design-system components do not accept `className`.
Application code cannot pass arbitrary CSS classes because the type signature forbids it.

### Linter

The linter blocks:

- `className=` usage in scoped application files
- `style=` usage in scoped application files
- Route-local styled native form controls (`button`, `input`, `select`, `textarea` with `className` or `style`)

### Why this is simpler

The previous approach tried to block individual Tailwind utility patterns with regex (spacing, colors, typography).
That required maintaining pattern lists and missed new utilities.

The current model blocks the mechanism (`className`, `style`), not the content.
If you can't write `className=`, you can't use any utility — spacing, color, layout, or otherwise.

## Pre-commit

The pre-commit hook runs staged design-system lint so violations fail before a commit is recorded.

## CI

CI reruns the contract so drift cannot merge through inconsistent local environments.

## Exception policy

Allowed exceptions must include a reason marker on the same line as the violation or the immediately preceding line:

```tsx
// ds-exception: reason
```

Any exception without a reason is treated as a violation.
