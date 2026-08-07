/// <reference types="@cloudflare/vitest-pool-workers" />

// Ambient types so `cloudflare:test` (SELF, env, …) resolves and env.* is typed.
declare module "cloudflare:test" {
  interface ProvidedEnv {
    DB: D1Database;
    SESSIONS: KVNamespace;
    PHOTOS?: R2Bucket;
    DEV_EMAIL?: string;
    FROM_ADDRESS?: string;
    ADMIN_EMAIL?: string;
    INGEST_TOKEN?: string;
  }
}
