import type {
  CreateTodoInput,
  Todo,
  TodoId,
  UpdateTodoInput,
} from "@/api/todo-schema"
import { TodoId as TodoIdSchema, TodoNotFound } from "@/api/todo-schema"
import { todosTable } from "@/db/schema"
import { asc, eq, sql } from "drizzle-orm"
import { drizzle as drizzlePglite } from "drizzle-orm/pglite"
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js"
import * as Config from "effect/Config"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as ServiceMap from "effect/ServiceMap"
import { Buffer } from "node:buffer"
import { mkdir } from "node:fs/promises"
import postgres from "postgres"

type RepositoryDatabaseConfig =
  | {
    readonly kind: "pglite"
    readonly dataDir: string | undefined
  }
  | {
    readonly kind: "postgres"
    readonly databaseUrl: string
  }

export type TodoSeed = ReadonlyArray<{
  readonly title: string
  readonly completed: boolean
}>

const decodeTodoId = Schema.decodeUnknownSync(TodoIdSchema)
const decodeCreatedAt = Schema.decodeUnknownSync(Schema.DateTimeUtcFromDate)

const createTodoRowSql = sql`
  CREATE TABLE IF NOT EXISTS todos (
    id text PRIMARY KEY,
    title text NOT NULL,
    completed boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL
  )
`

const toTodo = (row: typeof todosTable.$inferSelect): Todo => ({
  id: decodeTodoId(row.id),
  title: row.title,
  completed: row.completed,
  createdAt: decodeCreatedAt(row.createdAt),
})

const getUpdatePatch = (
  input: UpdateTodoInput,
): {
  readonly title?: string
  readonly completed?: boolean
} => {
  const patch: {
    title?: string
    completed?: boolean
  } = {}

  if (Option.isSome(input.title)) {
    patch.title = input.title.value
  }

  if (Option.isSome(input.completed)) {
    patch.completed = input.completed.value
  }

  return patch
}

const liveDatabaseConfig = Effect.gen(function*() {
  const databaseUrl = yield* Config.option(Config.string("DATABASE_URL"))
  const pgliteDataDir = yield* Config.string("PGLITE_DATA_DIR").pipe(
    Config.orElse(() => Config.succeed("./data/pglite")),
  )

  return Option.match(databaseUrl, {
    onNone: () =>
      ({
        kind: "pglite",
        dataDir: pgliteDataDir,
      }) satisfies RepositoryDatabaseConfig,
    onSome: (url) =>
      ({
        kind: "postgres",
        databaseUrl: url,
      }) satisfies RepositoryDatabaseConfig,
  })
})

/**
 * Dispatches to the correct repository implementation for the selected driver.
 *
 * @param config - The resolved database configuration.
 * @returns A scoped Effect repository implementation for the selected adapter.
 */
function makeRepository(config: RepositoryDatabaseConfig) {
  return config.kind === "postgres"
    ? makePostgresRepository(config.databaseUrl)
    : makePgliteRepository(config.dataDir)
}

const makeLiveRepository = Effect
  .flatMap(
    liveDatabaseConfig,
    makeRepository,
  )
  .pipe(
    Effect.mapError(
      (error) =>
        new Error(
          `Failed to initialize TodosRepository: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
    ),
    Effect.orDie,
  )

type TodoRow = typeof todosTable.$inferSelect

type TodoRepository = {
  readonly list: Effect.Effect<ReadonlyArray<Todo>>
  readonly getById: (id: TodoId) => Effect.Effect<Todo, TodoNotFound>
  readonly create: (input: CreateTodoInput) => Effect.Effect<Todo>
  readonly update: (
    id: TodoId,
    input: UpdateTodoInput,
  ) => Effect.Effect<Todo, TodoNotFound>
  readonly remove: (id: TodoId) => Effect.Effect<void, TodoNotFound>
}

type RepositoryQueries = {
  readonly listRows: () => Promise<Array<TodoRow>>
  readonly findRowById: (id: TodoId) => Promise<TodoRow | undefined>
  readonly insertRow: (
    id: TodoId,
    input: CreateTodoInput,
    now: Date,
  ) => Promise<TodoRow | undefined>
  readonly updateRow: (
    id: TodoId,
    patch: {
      readonly title?: string
      readonly completed?: boolean
    },
  ) => Promise<TodoRow | undefined>
  readonly deleteRow: (
    id: TodoId,
  ) => Promise<TodoId | undefined>
}

/**
 * Builds a CRUD repository from a set of low-level query functions.
 *
 * @param queries - The adapter-specific query implementations.
 * @returns A repository implementing list, getById, create, update, remove.
 */
function makeCrudRepository(queries: RepositoryQueries): TodoRepository {
  const getById = (id: TodoId) =>
    Effect.gen(function*() {
      const todo = yield* Effect.promise(() => queries.findRowById(id))

      if (todo === undefined) {
        return yield* Effect.fail(new TodoNotFound({ id }))
      }

      return toTodo(todo)
    })

  return {
    list: Effect
      .promise(() => queries.listRows().then((rows) => rows.map(toTodo)))
      .pipe(Effect.withSpan("TodosRepository.list")),
    getById: (id: TodoId) =>
      getById(id).pipe(
        Effect.withSpan("TodosRepository.getById", {
          attributes: { "todo.id": id },
        }),
      ),
    create: (input: CreateTodoInput) =>
      Effect
        .gen(function*() {
          const id = decodeTodoId(crypto.randomUUID())
          const now = yield* DateTime.now
          const todo = yield* Effect.promise(() =>
            queries.insertRow(id, input, DateTime.toDateUtc(now))
          )

          if (todo === undefined) {
            return yield* Effect.die(
              new Error("Todo insert did not return a row"),
            )
          }

          return toTodo(todo)
        })
        .pipe(
          Effect.withSpan("TodosRepository.create", {
            attributes: { "todo.title": input.title },
          }),
        ),
    update: (id: TodoId, input: UpdateTodoInput) =>
      Effect
        .gen(function*() {
          const patch = getUpdatePatch(input)
          if (Object.keys(patch).length === 0) {
            return yield* getById(id)
          }

          const todo = yield* Effect.promise(() => queries.updateRow(id, patch))

          if (todo === undefined) {
            return yield* Effect.fail(new TodoNotFound({ id }))
          }

          return toTodo(todo)
        })
        .pipe(
          Effect.withSpan("TodosRepository.update", {
            attributes: { "todo.id": id },
          }),
        ),
    remove: (id: TodoId) =>
      Effect
        .gen(function*() {
          const removed = yield* Effect.promise(() => queries.deleteRow(id))

          if (removed === undefined) {
            return yield* Effect.fail(new TodoNotFound({ id }))
          }
        })
        .pipe(
          Effect.withSpan("TodosRepository.remove", {
            attributes: { "todo.id": id },
          }),
        ),
  }
}

export class TodosRepository extends ServiceMap.Service<TodosRepository>()(
  "TodosRepository",
  {
    make: makeLiveRepository,
  },
) {
  static readonly layer = Layer.effect(this, this.make)

  static readonly testLayer = this.layerFromConfig({
    kind: "pglite",
    dataDir: undefined,
  })

  /**
   * Creates an in-memory PGlite repository layer preloaded with a deterministic seed.
   *
   * @param seed - The rows to insert before the test effect runs.
   * @returns A layer providing the seeded repository service.
   */
  static layerFromSeed(seed: TodoSeed): Layer.Layer<TodosRepository> {
    return Layer.effect(
      this,
      Effect.gen(function*() {
        const repository = yield* makePgliteRepository(undefined, seed)
        return TodosRepository.of(repository)
      }),
    )
  }

  /**
   * Creates a repository layer for an explicit database target.
   *
   * @param config - The database target to use for the repository.
   * @returns A layer providing the repository service.
   */
  static layerFromConfig(
    config: RepositoryDatabaseConfig,
  ): Layer.Layer<TodosRepository> {
    return Layer.effect(this, makeRepository(config))
  }
}

/**
 * Builds a PostgreSQL-backed repository using the shared Postgres schema.
 *
 * @param databaseUrl - The PostgreSQL connection string.
 * @returns A scoped repository Effect backed by postgres.js and Drizzle.
 */
function makePostgresRepository(databaseUrl: string) {
  return Effect
    .gen(function*() {
      const client = postgres(databaseUrl, {
        prepare: false,
      })
      const db = drizzlePostgres(client, {
        schema: { todosTable },
      })

      yield* Effect.promise(() => db.execute(createTodoRowSql))
      yield* Effect.addFinalizer(() => Effect.promise(() => client.end()))

      return makeCrudRepository({
        listRows: () =>
          db
            .select()
            .from(todosTable)
            .orderBy(
              asc(todosTable.createdAt),
              asc(todosTable.id),
            ),
        findRowById: (id) =>
          db
            .select()
            .from(todosTable)
            .where(eq(todosTable.id, id))
            .limit(1)
            .then(
              ([todo]) => todo,
            ),
        insertRow: (id, input, now) =>
          db
            .insert(todosTable)
            .values({
              id,
              title: input.title,
              completed: false,
              createdAt: now,
            })
            .returning()
            .then(([todo]) => todo),
        updateRow: (id, patch) =>
          db
            .update(todosTable)
            .set(patch)
            .where(eq(todosTable.id, id))
            .returning()
            .then(([todo]) => todo),
        deleteRow: (id) =>
          db
            .delete(todosTable)
            .where(eq(todosTable.id, id))
            .returning({ id: todosTable.id })
            .then((
              [todo],
            ) => (todo === undefined ? undefined : decodeTodoId(todo.id))),
      })
    })
    .pipe(Effect.orDie)
}

/**
 * Builds a PGlite-backed repository for local embedded Postgres storage.
 *
 * @param dataDir - Optional local persistence directory for PGlite.
 * @param seed - Optional deterministic seed rows for invariant-style tests.
 * @returns A scoped repository Effect backed by PGlite and Drizzle.
 */
function makePgliteRepository(
  dataDir: string | undefined,
  seed: TodoSeed = [],
) {
  return Effect
    .gen(function*() {
      if (dataDir !== undefined) {
        yield* Effect.promise(() => mkdir(dataDir, { recursive: true }))
      }

      const PGlite = yield* Effect.promise(async () => {
        if (globalThis.Buffer === undefined) {
          globalThis.Buffer = Buffer
        }

        const module = await import("@electric-sql/pglite")
        return module.PGlite
      })
      const client = yield* Effect.sync(() =>
        dataDir === undefined ? new PGlite() : new PGlite(dataDir)
      )
      const db = drizzlePglite({
        client,
        schema: { todosTable },
      })

      yield* Effect.promise(() => db.execute(createTodoRowSql))
      yield* seedPgliteRows(db, seed)
      yield* Effect.addFinalizer(() => Effect.promise(() => client.close()))

      return makeCrudRepository({
        listRows: () =>
          db
            .select()
            .from(todosTable)
            .orderBy(
              asc(todosTable.createdAt),
              asc(todosTable.id),
            ),
        findRowById: (id) =>
          db
            .select()
            .from(todosTable)
            .where(eq(todosTable.id, id))
            .limit(1)
            .then(
              ([todo]) => todo,
            ),
        insertRow: (id, input, now) =>
          db
            .insert(todosTable)
            .values({
              id,
              title: input.title,
              completed: false,
              createdAt: now,
            })
            .returning()
            .then(([todo]) => todo),
        updateRow: (id, patch) =>
          db
            .update(todosTable)
            .set(patch)
            .where(eq(todosTable.id, id))
            .returning()
            .then(([todo]) => todo),
        deleteRow: (id) =>
          db
            .delete(todosTable)
            .where(eq(todosTable.id, id))
            .returning({ id: todosTable.id })
            .then((
              [todo],
            ) => (todo === undefined ? undefined : decodeTodoId(todo.id))),
      })
    })
    .pipe(Effect.orDie)
}

/**
 * Inserts deterministic seeded rows directly into PGlite for invariant tests.
 *
 * @param db - The Drizzle PGlite database to populate.
 * @param seed - The rows to insert before a test executes.
 * @returns An Effect that completes once all seed rows are written.
 */
function seedPgliteRows(
  db: ReturnType<typeof drizzlePglite>,
  seed: TodoSeed,
) {
  if (seed.length === 0) {
    return Effect.void
  }

  return Effect.promise(() =>
    db.insert(todosTable).values(
      seed.map((item, index) => ({
        id: decodeTodoId(`seed-${index}`),
        title: item.title,
        completed: item.completed,
        createdAt: new Date(Date.UTC(2024, 0, 1, 0, 0, 0, index)),
      })),
    )
  )
}
