import type {
  Institution,
  PaperSite,
  PaperSource,
  Topic,
} from "@/api/paper-schema"
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

export const papersTable = pgTable("papers", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  abstract: text("abstract").notNull(),
  summary: text("summary").notNull(),
  year: integer("year").notNull(),
  venue: text("venue").notNull(),
  authors: jsonb("authors").$type<ReadonlyArray<string>>().notNull(),
  topics: jsonb("topics").$type<ReadonlyArray<Topic>>().notNull(),
  citations: integer("citations").notNull(),
  readMinutes: integer("read_minutes").notNull(),
  site: text("site").$type<PaperSite>().notNull(),
  source: text("source").$type<PaperSource>().notNull(),
  externalUrl: text("external_url"),
  isOpenAccess: boolean("is_open_access").notNull(),
  allowedInstitutions: jsonb("allowed_institutions")
    .$type<ReadonlyArray<Institution>>(),
  fetchedAt: timestamp("fetched_at", {
    mode: "date",
    withTimezone: true,
  })
    .notNull(),
})

export const impressionsTable = pgTable("impressions", {
  id: text("id").primaryKey(),
  readerId: text("reader_id").notNull(),
  paperId: text("paper_id").notNull(),
  shownAt: timestamp("shown_at", {
    mode: "date",
    withTimezone: true,
  })
    .notNull(),
  dwellMs: integer("dwell_ms"),
  position: integer("position").notNull(),
  exploration: boolean("exploration").notNull().default(false),
})

export const reactionsTable = pgTable("reactions", {
  id: text("id").primaryKey(),
  readerId: text("reader_id").notNull(),
  paperId: text("paper_id").notNull(),
  kind: text("kind").notNull(),
  active: boolean("active").notNull(),
  createdAt: timestamp("created_at", {
    mode: "date",
    withTimezone: true,
  })
    .notNull(),
})

export const readerProfilesTable = pgTable("reader_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  institution: text("institution").notNull(),
  beats: jsonb("beats").$type<ReadonlyArray<string>>().notNull(),
  onboardedAt: timestamp("onboarded_at", {
    mode: "date",
    withTimezone: true,
  })
    .notNull(),
})

export const feedSessionsTable = pgTable("feed_sessions", {
  id: text("id").primaryKey(),
  readerId: text("reader_id").notNull(),
  seenPaperIds: jsonb("seen_paper_ids")
    .$type<ReadonlyArray<string>>()
    .notNull(),
  cursor: text("cursor"),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    withTimezone: true,
  })
    .notNull(),
})

/**
 * A signed-in reader (SPEC §17.5). An account is only a claim on reader ids:
 * `readerId` is the canonical one whose state later devices merge into.
 */
export const accountsTable = pgTable("accounts", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  readerId: text("reader_id").notNull(),
  createdAt: timestamp("created_at", {
    mode: "date",
    withTimezone: true,
  })
    .notNull(),
})

/** Every reader id an account may be reached through, canonical first. */
export const accountReadersTable = pgTable("account_readers", {
  accountId: text("account_id").notNull(),
  readerId: text("reader_id").notNull(),
  claimedAt: timestamp("claimed_at", {
    mode: "date",
    withTimezone: true,
  })
    .notNull(),
})

/** One emailed sign-in link. Only the token digest is stored. */
export const loginTokensTable = pgTable("login_tokens", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  readerId: text("reader_id").notNull(),
  createdAt: timestamp("created_at", {
    mode: "date",
    withTimezone: true,
  })
    .notNull(),
  expiresAt: timestamp("expires_at", {
    mode: "date",
    withTimezone: true,
  })
    .notNull(),
  consumedAt: timestamp("consumed_at", {
    mode: "date",
    withTimezone: true,
  }),
})

// Migration source only. New reader state is never written here.
export const readerStateTable = pgTable("reader_state", {
  id: text("id").primaryKey(),
  stateJson: text("state_json").notNull(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    withTimezone: true,
  })
    .notNull(),
})
