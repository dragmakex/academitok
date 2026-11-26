/**
 * Accounts and magic-link sign-in (SPEC §17.5). State stays keyed by
 * `reader_id`; an account is only a claim on one or more reader ids, so a
 * signed-in reader keeps the same taste and clippings they accumulated
 * anonymously, and a second device merges into the same account.
 *
 * Queries go through a narrow `AccountStore` because the two database adapters
 * expose different clients while the statements are identical; the store keeps
 * one copy of the SQL instead of two.
 */

import type { accountsTable, loginTokensTable } from "@/db/schema"
import { maxLinksPerHour } from "@/lib/magic-link"
import { randomUUID } from "node:crypto"

type SqlParam = string | number | boolean | Date | null

type AccountRow = Pick<typeof accountsTable.$inferSelect, "id" | "readerId">
type SpentTokenRow = Pick<typeof loginTokensTable.$inferSelect, "email">
type AccountEmailRow = Pick<typeof accountsTable.$inferSelect, "email">
type AccountReaderRow = Pick<typeof accountsTable.$inferSelect, "readerId">
type CountRow = { readonly count: unknown }

/** One parameterised statement against the reader-state database. */
export type AccountStore = {
  readonly query: <Row extends Record<string, unknown>>(
    sql: string,
    params: ReadonlyArray<SqlParam>,
  ) => Promise<ReadonlyArray<Row>>
}

/** What the deck shows about the current reader. */
export type SessionInfo = {
  readonly email: string | null
}

export type RequestLinkInput = {
  readonly email: string
  readonly readerId: string
  readonly tokenHash: string
  readonly now: Date
  readonly expiresAt: Date
}

export type ConsumeLinkInput = {
  readonly tokenHash: string
  readonly readerId: string
  readonly now: Date
}

export interface AccountsRepository {
  /**
   * Records a sign-in link, unless this address asked too often this hour.
   * @param input - Address, requesting reader, token digest and lifetimes.
   * @returns False when the hourly cap dropped the request.
   */
  readonly requestLink: (input: RequestLinkInput) => Promise<boolean>
  /**
   * Spends a link and claims the current reader for its account.
   * @param input - Token digest, current reader, current time.
   * @returns The address now signed in, or null when the link is spent.
   */
  readonly consumeLink: (
    input: ConsumeLinkInput,
  ) => Promise<SessionInfo | null>
  /**
   * Reads the account a reader belongs to.
   * @param readerId - Reader id from the request cookie.
   * @returns The signed-in address, or null for an anonymous reader.
   */
  readonly session: (readerId: string) => Promise<SessionInfo>
  /**
   * Resolves the reader that owns an account's data.
   * @param readerId - Reader id from the request cookie.
   * @returns The account's canonical reader, or the given id when unclaimed,
   * so a device claimed by an account reads and writes the same rows.
   */
  readonly canonicalReaderId: (readerId: string) => Promise<string>
}

/** Sign-in links accepted per address in the trailing hour. */
const rateWindowMs = 60 * 60 * 1_000

const countOf = (value: unknown): number =>
  typeof value === "number" ? value : Number(value ?? 0)

/**
 * Builds the accounts repository over one database client.
 * @param store - Parameterised statement runner for the reader-state database.
 * @returns The accounts repository.
 */
export const makeAccountsRepository = (
  store: AccountStore,
): AccountsRepository => {
  // Aliases only ever grow, and only when a device signs in, so a positive
  // answer is safe to keep for the life of the process; a miss stays a miss.
  const canonicalByAlias = new Map<string, string>()
  /**
   * Folds a second reader into the account's canonical reader. Reactions keep
   * the newest write per paper and kind; impressions and sessions simply move;
   * the canonical profile wins because its id is the reader id.
   * @param canonical - Reader id the account owns.
   * @param other - Reader id the newly claimed device was reading under.
   */
  const mergeReader = async (
    canonical: string,
    other: string,
  ): Promise<void> => {
    await store.query(
      `DELETE FROM reactions o
        WHERE o.reader_id = $2
          AND EXISTS (
            SELECT 1 FROM reactions c
             WHERE c.reader_id = $1
               AND c.paper_id = o.paper_id
               AND c.kind = o.kind
               AND c.created_at >= o.created_at
          )`,
      [canonical, other],
    )
    await store.query(
      `UPDATE reactions SET reader_id = $1 WHERE reader_id = $2`,
      [
        canonical,
        other,
      ],
    )
    await store.query(
      `UPDATE impressions SET reader_id = $1 WHERE reader_id = $2`,
      [canonical, other],
    )
    await store.query(
      `UPDATE feed_sessions SET reader_id = $1 WHERE reader_id = $2`,
      [canonical, other],
    )
    await store.query(
      `DELETE FROM reader_profiles
        WHERE id = $2 AND EXISTS (SELECT 1 FROM reader_profiles WHERE id = $1)`,
      [canonical, other],
    )
    await store.query(`UPDATE reader_profiles SET id = $1 WHERE id = $2`, [
      canonical,
      other,
    ])
  }

  const claimReader = async (
    email: string,
    readerId: string,
    now: Date,
  ): Promise<SessionInfo> => {
    await store.query(
      `INSERT INTO accounts (id, email, reader_id, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [randomUUID(), email, readerId, now],
    )
    const [account] = await store.query<AccountRow>(
      `SELECT id, reader_id AS "readerId" FROM accounts WHERE email = $1`,
      [email],
    )
    if (account === undefined) {
      throw new Error(`account row missing after claim: ${email}`)
    }
    const canonical = account.readerId
    canonicalByAlias.set(readerId, canonical)
    await store.query(
      `INSERT INTO account_readers (account_id, reader_id, claimed_at)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [account.id, readerId, now],
    )
    if (canonical !== readerId) {
      await mergeReader(canonical, readerId)
    }
    return { email }
  }

  return {
    requestLink: async (input) => {
      const windowStart = new Date(input.now.getTime() - rateWindowMs)
      const [recent] = await store.query<CountRow>(
        `SELECT count(*) AS count FROM login_tokens
          WHERE email = $1 AND created_at > $2`,
        [input.email, windowStart],
      )
      if (countOf(recent?.count) >= maxLinksPerHour) {
        return false
      }
      await store.query(
        `INSERT INTO login_tokens
           (id, email, token_hash, reader_id, created_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          randomUUID(),
          input.email,
          input.tokenHash,
          input.readerId,
          input.now,
          input.expiresAt,
        ],
      )
      return true
    },

    consumeLink: async (input) => {
      const spent = await store.query<SpentTokenRow>(
        `UPDATE login_tokens
            SET consumed_at = $2
          WHERE token_hash = $1
            AND consumed_at IS NULL
            AND expires_at > $2
          RETURNING email`,
        [input.tokenHash, input.now],
      )
      const email = spent[0]?.email
      if (typeof email !== "string") {
        return null
      }
      return claimReader(email, input.readerId, input.now)
    },

    session: async (readerId) => {
      const [row] = await store.query<AccountEmailRow>(
        `SELECT a.email FROM account_readers r
           JOIN accounts a ON a.id = r.account_id
          WHERE r.reader_id = $1
          LIMIT 1`,
        [readerId],
      )
      return { email: typeof row?.email === "string" ? row.email : null }
    },

    canonicalReaderId: async (readerId) => {
      const claimed = canonicalByAlias.get(readerId)
      if (claimed !== undefined) {
        return claimed
      }
      const [row] = await store.query<AccountReaderRow>(
        `SELECT a.reader_id AS "readerId" FROM account_readers r
           JOIN accounts a ON a.id = r.account_id
          WHERE r.reader_id = $1
          LIMIT 1`,
        [readerId],
      )
      if (typeof row?.readerId !== "string") {
        return readerId
      }
      canonicalByAlias.set(readerId, row.readerId)
      return row.readerId
    },
  }
}
