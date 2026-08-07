# Reference data seeds

Seed data for the `ref_*` enrichment layer (defined in `../schema.sql`). The
coffee data foundation: taxonomy (countries/regions/varieties/processes/flavors),
the glossary, roasters, and real Cup of Excellence lots.

**Provenance:** every row records where it came from. `ref_coffees`/`ref_producers`
COE rows were fetched from farmdirectory.cupofexcellence.org (`source_url`, confidence
`high`). Varieties are a curated draft derived from World Coffee Research — verify
against the WCR catalog before treating as authoritative. Roasters are general
knowledge (confidence `medium`).

## Load order

`../schema.sql` must be applied first (it creates the tables). Then, because of
foreign keys, load in this order — parents before children:

1. `origins.sql`       — countries → harvest windows → regions
2. `varieties.sql`     — varieties → lineage edges
3. `processes.sql`
4. `flavor-wheel.sql`  — ref_flavors (self-referential, tier 1→3)
4b. `flavors-aliases.sql` — bag/roaster synonyms → ref_flavors.aliases (UPDATEs;
    MUST run after flavor-wheel.sql, which would otherwise reset aliases to NULL)
5. `roasters.sql`      — adds consuming countries, then roasters
6. `glossary.sql`
7. `coffees-coe.sql`   — producers + lots
8. `coffees-coe-2.sql` — more lots (after coffees-coe)
9. `coffees-coe-3.sql` — non-Geisha lots (adds Nicaragua + Maracaturra/Bernardina varieties)
10. `drops.sql`        — water concentrate catalog (ref_salts/ref_drop_brands/ref_drops);
    independent of the coffee seeds (depends only on schema.sql), so order-agnostic.

## Apply

```bash
export CLOUDFLARE_ACCOUNT_ID=REPLACE_ME
# schema first (idempotent — CREATE TABLE IF NOT EXISTS):
npx --no-install wrangler d1 execute water-lab --local --file=schema.sql
# then seeds (swap --local for --remote to load production):
for f in origins varieties processes flavor-wheel roasters glossary coffees-coe coffees-coe-2 drops; do
  npx --no-install wrangler d1 execute water-lab --local --file=seed/$f.sql || break
done
```

Notes:
- Seed files use `INSERT OR REPLACE`, so re-running is idempotent.
- No `BEGIN/COMMIT` — D1 manages transactions and rejects explicit ones.
- The local miniflare SQLite caps compound `SELECT` at ~5 terms (remote D1 does not).
- Source of these seeds: `~/Downloads/ppmgauge-db_resources/` (design docs + `enrich-worker.ts`).
