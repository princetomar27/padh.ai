import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is missing. Please set it in .env.local",
  );
}

/**
 * db: Drizzle ORM instance connected to Neon PostgreSQL.
 *
 * The { schema } option enables the relational query API:
 *   db.query.userProfiles.findMany({ with: { ... } })
 *
 * alongside the standard SQL builder:
 *   db.select().from(schema.userProfiles).where(...)
 */
export const db = drizzle(process.env.DATABASE_URL, { schema });

export { schema };
