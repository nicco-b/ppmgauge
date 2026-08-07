// Apply schema.sql + reference seeds to the LOCAL miniflare D1.
//   npm run seed:local            # minimal working set (fast)
//   npm run seed:local -- --full  # + the large enrichment files (slow)
// FK-safe order per seed/README.md (parents → children).
import { spawnSync } from "node:child_process";

const full = process.argv.includes("--full");

// Canonical working set (seed/README.md load order).
const MINIMAL = [
  "origins",
  "varieties",
  "processes",
  "flavor-wheel",
  "flavors-aliases",
  "roasters",
  "glossary",
  "coffees-coe",
  "coffees-coe-2",
  "coffees-coe-3",
  "drops",
];

// Optional heavy enrichment (multi-MB; slow into local SQLite). Order is
// best-effort — adjust against seed/README.md if a file errors on FK.
const EXTRA = [
  "varieties-wcr",
  "varieties-wcr-catalog",
  "varieties-specialty",
  "regions-expanded",
  "processes-expanded",
  "roasters-expanded",
  "roasters-batch2",
  "roasters-dedupe",
  "roasters-enrich",
  "roasters-enrich2",
  "roasters-enrich3",
  "roasters-coords",
  "coffees-coe-full",
  "coffees-coe-directory",
  "coffees-coe-enrich",
  "coffees-coe-flavors",
  "coffees-coe-coords",
  "coffees-cqi",
  "coffees-roaster-feeds",
  "gear",
  "producers-coarse-fill",
  "producers-geocode",
];

function d1(args) {
  const r = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", "water-lab", "--local", ...args],
    { stdio: "inherit" },
  );
  if (r.status !== 0) {
    console.error("FAILED:", args.join(" "));
    process.exit(r.status ?? 1);
  }
}

console.log("→ applying schema.sql");
d1(["--file=schema.sql"]);

const files = full ? [...MINIMAL, ...EXTRA] : MINIMAL;
console.log(`→ loading ${files.length} seed files (${full ? "FULL" : "minimal"})`);
for (const name of files) {
  console.log(`  · seed/${name}.sql`);
  d1([`--file=seed/${name}.sql`]);
}
console.log("✓ local D1 seeded");
