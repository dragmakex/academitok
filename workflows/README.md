# Workflow Templates

## `codefabrik.tsx`

`codefabrik.tsx` is the baseline Smithers workflow template for running a
spec-driven implementation loop on a dedicated jj bookmark.

The workflow now enforces this task order inside an inner `Sequence` within
`Ralph`:

1. `discover`
2. `implement`
3. `review`
4. `validate`
5. `fix`
6. `commit`
7. `push`

That sequencing matters because `discover` must finish before later tasks begin.
Without the inner `Sequence`, Smithers can mount tasks concurrently and race
`implement` or `review` ahead of discovery.

## Inputs

The workflow accepts these run inputs:

- `branch`: bookmark name for the run
- `todoPath`: path to the backlog document, default `todo.md`
- `specsPath`: path to the spec entrypoint, default `specs/README.md`
- `spec`: optional inline run-specific instruction appended to the default prompt

The default discover prompt is generic. It tells the agent to:

- read `specsPath`
- read `todoPath`
- choose the next best vertical slice
- execute TDD end to end
- commit on the workflow bookmark selected for the run

## Bookmark And Push Behavior

The template creates the workflow change from the correct jj base:

- if the current `@` is empty, it branches from `@-`
- otherwise it branches from `@`

That avoids inheriting useless empty scratch ancestry into new workflow
bookmarks.

When a slice is ready, the template:

1. runs `jj describe -m ...`
2. captures the finished change id
3. moves the workflow bookmark to `@`
4. opens a fresh empty change with `jj new`

The bookmark move must happen before `jj new`, otherwise the bookmark points at
the new empty working copy instead of the finished slice.

Publishing uses:

```bash
jj --ignore-working-copy git push --allow-empty-description --remote origin --bookmark <branch>
```

`--ignore-working-copy` ensures the push targets the finished bookmarked slice
instead of the fresh empty `@`. `--allow-empty-description` avoids older empty
local scratch commits blocking publication.
