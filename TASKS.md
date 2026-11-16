# TASKS — execution queue

Work top to bottom. Take the **first unchecked task only**, implement it, run
`bun run validate`, commit, then tick the box. Never re-audit the whole repo and never
report "already implemented" — if a task is already satisfied, tick it, note the commit
that satisfies it on the same line, and move to the next.

Task order is dependency order, not priority order. Source of truth for requirements:
`SPEC.md`. If a task conflicts with the spec, stop and write the conflict at the bottom.

---

## P1 — data layer

- [ ] **1. Split the reader-state JSON blob into tables.** Per SPEC §6: `papers`,
      `impressions`, `reactions`, `reader_profiles`, `feed_sessions` in `src/db/schema.ts`.
      Migrate existing `reader_state.state_json` on first read, keep the blob read-only as a
      migration source, delete it after a clean run. Accept: `bun run validate` green, a
      `-pglite-reader-state` restart preserves likes/saves/hides, `docs/guides/database-pglite.md`
      notes the migration.
- [ ] **2. Batched impression transport.** Per SPEC §9: client buffers impression events,
      flushes every 10 events and on `visibilitychange`; one RPC call per batch. Accept: no
      per-slide RPC during a 20-slide scroll (check network log), dwell_ms still recorded,
      test covering the flush-on-hide path.

## P1 — the algo finishes learning

- [ ] **3. Content affinity (tf-idf cosine).** SPEC §8.1 term `0.9·contentAffinity`:
      build the centroid from liked and saved abstracts, cosine against candidate abstracts.
      No new dependency — tokenise and weight by hand. Accept: unit tests for the centroid,
      known-similar abstracts outrank unrelated ones, `bun run test:coverage` green.
- [ ] **4. MMR diversity.** SPEC §8.1 step 4: replace the greedy topic/author caps with
      `argmax(λ·score − (1−λ)·maxSim)`, λ = 0.7, using `0.5·cosine + 0.5·topicJaccard`. Keep
      the hard caps as a guard rail. Accept: a page of 10 still respects ≤2 per topic and
      ≤1 per author; a test shows MMR demoting a near-duplicate that raw score would have kept.
- [ ] **5. Author and venue affinity.** SPEC §8.1 term `0.5·authorVenueAffinity`, decayed
      like topic affinity. Accept: liking two papers by the same author raises that author's
      later papers; test asserts ordering.
- [ ] **6. Onboarding picks.** SPEC §8.2: 15 candidates in 3 pages of 5, keep/discard,
      ≥5 keeps required or explicitly skipped; seeds topic affinity and the content centroid.
      `profile.onboard` RPC. Accept: fresh DB + onboarding produces a non-uniform feed;
      skipping still yields a valid page.
- [ ] **7. `WHY THIS` from real scoring terms.** SPEC §8.3: rationale must cite only terms
      that actually fired, max 2, no filler. Accept: test that a cold-start item shows only
      the beat name, and a high-affinity item cites the term that won.

## P1 — product surface and identity

- [ ] **8. Feed health metrics.** SPEC §8.4: emit `impression`, `dwell`, `reaction`,
      `feed.next` events to PostHog with hashed reader id. Accept: events visible locally,
      `docs/guides/posthog.md` updated with the feed event table.
- [ ] **9. Repo identity.** Replace the template `README.md` and `package.json` name with
      AcademiTok (link `PROMPT.md`, `SPEC.md`, `AGENTS.md`). Accept: no "Effect TanStack Start"
      marketing copy left, no stale todo screenshots.
- [ ] **10. Retire the todo template.** Delete `src/features/todos/`, todo routes, todo
      docs and their tests in **one** commit after everything above is green. Accept:
      `bun run validate` green with the feature gone, no dangling imports.

---

## Blocked / needs a human decision

Record conflicts here instead of guessing: task number, what the spec says, what the code
says, what you chose not to do.
