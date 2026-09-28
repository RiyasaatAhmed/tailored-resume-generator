import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/postgres",
  },
  // pgcrypto (gen_random_uuid) and citext are created by the migration in
  // drizzle/0000_extensions.sql, not managed by drizzle-kit.
  extensionsFilters: [],
  verbose: true,
  strict: true,
});
