# Task: Analytics & Observability

You are an implementation agent working on master.

## Specification

Your task is pick the most high leverage TODO that needs to be done from TODO.md
Work on it and drive it to completion.

## Working Directory

- Repository: `https://github.com/dtechvision/effect-tanstack-baseline`
- Branch: `master`

## Instructions

1. Familiarize yourself with the codebase.
2. Implement the most important task/feature
3. Write tests as you go (you decide if unit tests, property tests or integration tests, e2e tests make the most sense.
4. Commit after each logical unit of work
5. When complete, commit and push.

## Communication Protocol

Check `./inbox/` for messages from reviewer agents.
Write responses to `./outbox/` when you need clarification.

### On completion, output:

```json
{
  "status": "DONE",
  "summary": "Implemented X, Y, Z",
  "pr": "URL or branch name"
}
```

### If blocked, output:

```json
{ "status": "BLOCKED", "summary": "What's wrong", "question": "What you need" }
```

### If you receive review feedback:

Read `./inbox/review-*.md`, address the feedback, then continue.

## Current State

<!-- Updated by orchestrator -->

- Iteration: {{ITERATION}}
- Last status: {{LAST_STATUS}}
- Pending reviews: {{PENDING_REVIEWS}}
