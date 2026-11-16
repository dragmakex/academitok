# TASKS — execution queue

Work top to bottom. Take the **first unchecked task only**, implement it, run
`bun run validate`, commit, then tick the box. One box per run. Never re-audit the whole
repo and never report "already implemented" — if a task is already satisfied, tick it with
the commit that satisfies it and take the next one, but never tick a box you did not verify
against code.

Source of truth for requirements: `SPEC.md`. If a task conflicts with the spec, stop and
write the conflict at the bottom instead of guessing.

---

## P1 leftover

- [x] **1. Persisted feed session state.** SPEC §16 remaining work: the cursor carries the
      session's seen ids, so a client can desynchronise from the server's idea of the session.
      Move it to a `feed_sessions` row (id, reader_id, seen paper ids, cursor, updated_at) with
      a TTL sweep. Accept: two `feed.next` calls with the same session id never repeat a paper
      even if the client passes a stale cursor; a fresh session id starts clean.
      — `41d1119`

## P2 — breadth

- [x] **2. `/saved` route.** SPEC §5: saved clippings as a static, filterable list, not a
      deck. Reuse the clipping component in a compact variant; no new design language. Accept:
      a saved paper appears there after a save and disappears after unsave; empty state reads
      as a broadsheet notice, not a spinner.
      — `70caa4a`
- [ ] **3. `/paper/$id` permalink.** SPEC §5: canonical page per paper with the clipping
      anatomy, full metadata and a copyable citation (authors, year, title, venue, DOI or URL).
      Accept: URL renders server-side for a known id, unknown id returns the not-found notice,
      citation copies to the clipboard, and the deck's permalink control reaches it.
- [ ] **4. Saved-collection export (BibTeX).** SPEC §14: generate `.bib` from the saved
      set in the repository layer, one `@article` per paper, DOIs as `doi`, stable keys.
      Accept: a 3-paper fixture yields 3 parseable entries with stable keys across runs; no
      network calls.

---

## Blocked — needs a product decision

- **Additional sources (arXiv, bioRxiv, Crossref).** Each adds a fetch client, a schema
  drift surface and rate-limit etiquette. Pick which one lands first, or none.
- **LLM dek behind a flag.** Costs money per page view and adds a provider dependency;
  SPEC keeps it out of P0. Needs a written cost ceiling before it becomes a task.

## Done (P1, for the record)

Reaction/impression tables · batched impression transport · tf-idf content affinity ·
MMR diversity with topic/author caps · author and venue affinity · onboarding picks ·
`WHY THIS` from real scoring terms · PostHog feed-health events · packaging identity ·
todo template retired.
