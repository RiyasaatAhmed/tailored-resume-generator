import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Pool } from "pg";

import { createDatabase, createPool } from "../client";

/**
 * A real Postgres for integration tests.
 *
 * `testing-strategy.md` rules out PGlite here, and not as a preference: it is
 * single-connection, and the highest-value test in the suite is two concurrent
 * transactions racing for the last credit. `pg-boss` also leans on SKIP LOCKED
 * across concurrent workers. Both need a real server.
 *
 * The container is migrated with the actual Drizzle migrations rather than a
 * schema push — that is the only way the migrations themselves get tested.
 */

export interface TestDatabase {
  container: StartedPostgreSqlContainer;
  pool: Pool;
  db: ReturnType<typeof createDatabase>;
  connectionString: string;
  /** Truncates every table, preserving the schema. Call between tests. */
  reset: () => Promise<void>;
  stop: () => Promise<void>;
}

export async function startTestDatabase(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer("postgres:17-alpine").start();
  const connectionString = container.getConnectionUri();

  const pool = createPool(connectionString);
  const db = createDatabase(pool);

  await migrate(db, { migrationsFolder: "./drizzle" });

  return {
    container,
    pool,
    db,
    connectionString,
    async reset() {
      // One statement, so foreign keys never block the order. RESTART IDENTITY
      // is harmless with uuid keys and correct if a serial is ever added.
      const { rows } = await pool.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables
          WHERE schemaname = 'public' AND tablename <> '__drizzle_migrations'`,
      );
      if (rows.length === 0) return;
      const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
      await pool.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
    },
    async stop() {
      await pool.end();
      await container.stop();
    },
  };
}
