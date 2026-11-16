import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const todosTable = pgTable("todos", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  dueDate: text("due_date"),
  createdAt: timestamp("created_at", {
    mode: "date",
    withTimezone: true,
  })
    .notNull(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    withTimezone: true,
  })
    .notNull(),
})

export const readerStateTable = pgTable("reader_state", {
  id: text("id").primaryKey(),
  stateJson: text("state_json").notNull(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    withTimezone: true,
  })
    .notNull(),
})
