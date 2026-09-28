import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export type Database = ReturnType<typeof createDatabase>;

/**
 * `pg` rather than postgres.js so the app and `pg-boss` share one driver —
 * ADR-0003 puts the queue in the same Postgres and the same process.
 */
export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}

export function createDatabase(pool: Pool) {
  return drizzle(pool, { schema });
}

let cached: { pool: Pool; db: ReturnType<typeof createDatabase> } | undefined;

/** The app-wide connection. Tests build their own against a container. */
export function getDatabase() {
  if (!cached) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    const pool = createPool(connectionString);
    cached = { pool, db: createDatabase(pool) };
  }
  return cached.db;
}
