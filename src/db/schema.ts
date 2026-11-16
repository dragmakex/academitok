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
  year: integer("year").notNull(),
  venue: text("venue").notNull(),
  authors: jsonb("authors").$type<ReadonlyArray<string>>().notNull(),
  topics: jsonb("topics").$type<ReadonlyArray<string>>().notNull(),
  citations: integer("citations").notNull(),
  site: text("site").notNull(),
  externalUrl: text("external_url"),
  isOpenAccess: boolean("is_open_access").notNull(),
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
