// Shared types. Lives in its own module so other files (auth.ts, email.ts, the
// upcoming routes/*) can import `Env` without depending on index.ts — which
// previously created a circular import (auth.ts ↔ index.ts).

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  SESSIONS: KVNamespace;
  EMAIL?: { send: (m: Record<string, unknown>) => Promise<unknown> };
  AI?: {
    run: (
      model: string,
      opts: Record<string, unknown>,
    ) => Promise<{ response?: string }>;
  };
  PHOTOS?: R2Bucket;
  DEV_EMAIL?: string;
  FROM_ADDRESS?: string;
  AI_MODEL?: string;
  ADMIN_EMAIL?: string; // who may ingest into the global graph (session gate)
  INGEST_TOKEN?: string; // optional bearer secret for scripted bulk loads
}
