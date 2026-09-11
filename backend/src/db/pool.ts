import pg from "pg";
import { config } from "../config.js";

// Lazy singleton — same reasoning as web/lib/chain.ts's getPublicClient(): fail loudly and
// specifically the first time something actually needs a connection, not at import time.
let _pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!config.database.url) {
    throw new Error("DATABASE_URL is not set — run backend/supabase/schema.sql on a Supabase project and add its connection string to .env");
  }
  if (!_pool) {
    _pool = new pg.Pool({
      connectionString: config.database.url,
      ssl: { rejectUnauthorized: false }, // Supabase's pooler requires TLS; not validating the
      // chain is the standard/accepted pattern for their pooler endpoints (shared certs, not a
      // per-project cert you'd otherwise pin).
      max: 5, // a hackathon-scale backend has no business holding more than a few connections
    });
  }
  return _pool;
}
