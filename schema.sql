-- Water Lab — D1 schema (Phase 2). Identity is passwordless (magic link);
-- magic-link tokens + sessions live in KV, not here. owner columns = users.id.

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recipes (
  id          TEXT PRIMARY KEY,
  owner       TEXT NOT NULL,
  name        TEXT NOT NULL,
  mode        TEXT NOT NULL,              -- 'single' | 'split'
  ratios      TEXT NOT NULL,              -- JSON snapshot of calculator inputs
  target_gl   REAL NOT NULL,
  drops_per_g REAL NOT NULL,
  shared      INTEGER NOT NULL DEFAULT 0, -- 1 = published to community pool
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS beans (
  id         TEXT PRIMARY KEY,
  owner      TEXT NOT NULL,
  name       TEXT NOT NULL,
  origin     TEXT, process TEXT, varietal TEXT, roaster TEXT, roast_date TEXT, notes TEXT,
  altitude   TEXT, producer TEXT, region TEXT, harvest TEXT,  -- printed-card fields (Phase 7)
  context    TEXT,                        -- AI origin-level context (labeled "typical for region")
  suggestion TEXT,                        -- cached water+brew suggestion JSON (generated once at save)
  color      TEXT,                        -- accent color pulled from the bag photo (Phase 5+)
  photo_key  TEXT,                        -- R2 key (unused for beans now; kept for brews/back-compat)
  tasting_notes TEXT,                      -- the bag's printed flavor notes (free text; resolved to wheel chips)
  -- resolved reference links into ref_* (enrichment graph). The text columns above
  -- stay as what the bag/user said; these *_id are the confirmed match (suggest-don't-overwrite).
  coffee_id   TEXT REFERENCES ref_coffees(id),
  producer_id TEXT REFERENCES ref_producers(id),
  roaster_id  TEXT REFERENCES ref_roasters(id),
  region_id   TEXT REFERENCES ref_regions(id),
  variety_id  TEXT REFERENCES ref_varieties(id),
  process_id  TEXT REFERENCES ref_processes(id),
  shared     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS brews (        -- private by default; opt-in shareable to the feed
  id           TEXT PRIMARY KEY,
  owner        TEXT NOT NULL,
  recipe_id    TEXT, bean_id TEXT,
  grind        TEXT, brew_time TEXT, water_ml REAL,
  gh REAL, kh REAL, tds REAL,             -- chemistry snapshot at brew time
  tasting_note TEXT, score INTEGER,       -- score 1..5
  photo_key    TEXT,
  shared       INTEGER NOT NULL DEFAULT 0, -- 1 = published to the community feed
  method TEXT, dose_g REAL, yield_g REAL, water_temp_c REAL, extraction_pct REAL,  -- extraction-science fields
  brewed_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calibrations (
  id            TEXT PRIMARY KEY,
  owner         TEXT NOT NULL,
  name          TEXT NOT NULL,
  comp          TEXT NOT NULL,            -- JSON: per-concentrate salt fractions
  reading_count INTEGER NOT NULL DEFAULT 0,
  shared        INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS readings (     -- measured data points (Phase 3 solver)
  id           TEXT PRIMARY KEY,
  owner        TEXT NOT NULL,
  ratios       TEXT NOT NULL, ppm REAL NOT NULL,
  measured_tds REAL, measured_gh REAL, measured_kh REAL,
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recipes_owner      ON recipes(owner);
CREATE INDEX IF NOT EXISTS idx_recipes_shared     ON recipes(shared);
CREATE INDEX IF NOT EXISTS idx_beans_owner        ON beans(owner);
CREATE INDEX IF NOT EXISTS idx_beans_shared       ON beans(shared);
CREATE INDEX IF NOT EXISTS idx_brews_owner        ON brews(owner);
CREATE INDEX IF NOT EXISTS idx_calibrations_owner ON calibrations(owner);
CREATE INDEX IF NOT EXISTS idx_readings_owner     ON readings(owner);

-- ====================================================================
-- ENRICHMENT REFERENCE LAYER (ppmgauge coffee data — see ppmgauge-db_resources)
-- Global ref_* tables (no owner), fully separate from user rows above.
-- Three trust tiers: curated taxonomy · provenance-tagged entities · user logbook.
-- Forward FK refs from beans/brews above resolve here (SQLite allows this).
-- ====================================================================

-- ── Taxonomy (curated, ships embedded) ──
CREATE TABLE IF NOT EXISTS ref_countries (
  code TEXT PRIMARY KEY, name TEXT NOT NULL, continent TEXT, hemisphere TEXT,
  aliases TEXT, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ref_harvest_windows (
  id TEXT PRIMARY KEY, country_code TEXT NOT NULL REFERENCES ref_countries(code),
  label TEXT, start_month INTEGER NOT NULL, end_month INTEGER NOT NULL, notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_harvest_country ON ref_harvest_windows(country_code);
CREATE TABLE IF NOT EXISTS ref_regions (
  id TEXT PRIMARY KEY, country_code TEXT NOT NULL REFERENCES ref_countries(code),
  name TEXT NOT NULL, altitude_min_m INTEGER, altitude_max_m INTEGER, lat REAL, lng REAL,
  typical_processes TEXT, aliases TEXT, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_regions_country ON ref_regions(country_code);
CREATE INDEX IF NOT EXISTS idx_regions_name    ON ref_regions(name);
CREATE TABLE IF NOT EXISTS ref_varieties (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, species TEXT NOT NULL, lineage TEXT,
  optimal_alt_min_m INTEGER, optimal_alt_max_m INTEGER, yield_potential TEXT,
  rust_resistance TEXT, bean_size TEXT, flavor_potential TEXT, notes TEXT, aliases TEXT,
  source TEXT, source_url TEXT, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_varieties_name    ON ref_varieties(name);
CREATE INDEX IF NOT EXISTS idx_varieties_species ON ref_varieties(species);
CREATE TABLE IF NOT EXISTS ref_variety_lineage (
  parent_id TEXT NOT NULL REFERENCES ref_varieties(id),
  child_id  TEXT NOT NULL REFERENCES ref_varieties(id),
  relation  TEXT, PRIMARY KEY (parent_id, child_id)
);
CREATE INDEX IF NOT EXISTS idx_lineage_child ON ref_variety_lineage(child_id);
CREATE TABLE IF NOT EXISTS ref_processes (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT, explainer TEXT,
  flavor_effect TEXT, aliases TEXT, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ref_flavors (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, parent_id TEXT REFERENCES ref_flavors(id),
  tier INTEGER NOT NULL, color TEXT, lexicon_ref TEXT,
  aliases TEXT  -- JSON array of lowercase roaster/bag synonyms ("white peach"->peach)
);
CREATE INDEX IF NOT EXISTS idx_flavors_parent ON ref_flavors(parent_id);
CREATE TABLE IF NOT EXISTS ref_certifications (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, body TEXT
);
CREATE TABLE IF NOT EXISTS ref_glossary (
  slug TEXT PRIMARY KEY, term TEXT NOT NULL, definition TEXT NOT NULL,
  category TEXT, related TEXT
);

-- ── Entities (mixed trust — provenance columns: source/confidence/fetched_at) ──
CREATE TABLE IF NOT EXISTS ref_producers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT,
  country_code TEXT REFERENCES ref_countries(code), region_id TEXT REFERENCES ref_regions(id),
  owner TEXT, founded TEXT, hectares REAL, altitude_min_m INTEGER, altitude_max_m INTEGER,
  lat REAL, lng REAL, geo_precision TEXT, story TEXT, photo_keys TEXT, website TEXT,
  source TEXT, source_url TEXT, confidence TEXT NOT NULL DEFAULT 'medium',
  fetched_at TEXT, updated_at TEXT NOT NULL
);  -- geo_precision: point (geocoded farm) | region | country (centroid + jitter)
CREATE INDEX IF NOT EXISTS idx_producers_country ON ref_producers(country_code);
CREATE INDEX IF NOT EXISTS idx_producers_region  ON ref_producers(region_id);
CREATE INDEX IF NOT EXISTS idx_producers_name    ON ref_producers(name);
CREATE TABLE IF NOT EXISTS ref_roasters (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT,
  country_code TEXT REFERENCES ref_countries(code), website TEXT,
  source TEXT, confidence TEXT NOT NULL DEFAULT 'medium', updated_at TEXT NOT NULL,
  about TEXT, founded TEXT, instagram TEXT, lat REAL, lng REAL  -- enrichment + geocoded city
);
CREATE INDEX IF NOT EXISTS idx_roasters_name ON ref_roasters(name);
CREATE TABLE IF NOT EXISTS ref_importers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, website TEXT, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ref_coffees (
  id TEXT PRIMARY KEY, name TEXT, roaster_id TEXT REFERENCES ref_roasters(id),
  producer_id TEXT REFERENCES ref_producers(id), importer_id TEXT REFERENCES ref_importers(id),
  country_code TEXT REFERENCES ref_countries(code), region_id TEXT REFERENCES ref_regions(id),
  process_id TEXT REFERENCES ref_processes(id), crop_year TEXT, lot_number TEXT, roast_level TEXT,
  published_score REAL, score_source TEXT, price REAL, currency TEXT, weight_g INTEGER, url TEXT,
  source TEXT NOT NULL, source_url TEXT, confidence TEXT NOT NULL DEFAULT 'medium', ingested_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_coffees_source   ON ref_coffees(source);
CREATE INDEX IF NOT EXISTS idx_coffees_roaster  ON ref_coffees(roaster_id);
CREATE INDEX IF NOT EXISTS idx_coffees_producer ON ref_coffees(producer_id);
CREATE TABLE IF NOT EXISTS ref_coffee_varieties (
  coffee_id TEXT NOT NULL REFERENCES ref_coffees(id), variety_id TEXT NOT NULL REFERENCES ref_varieties(id),
  PRIMARY KEY (coffee_id, variety_id)
);
CREATE TABLE IF NOT EXISTS ref_coffee_flavors (
  coffee_id TEXT NOT NULL REFERENCES ref_coffees(id), flavor_id TEXT NOT NULL REFERENCES ref_flavors(id),
  PRIMARY KEY (coffee_id, flavor_id)
);
CREATE TABLE IF NOT EXISTS ref_coffee_certifications (
  coffee_id TEXT NOT NULL REFERENCES ref_coffees(id), cert_id TEXT NOT NULL REFERENCES ref_certifications(id),
  PRIMARY KEY (coffee_id, cert_id)
);

-- ── User logbook: cupping (SCA form) — brews already exist above ──
CREATE TABLE IF NOT EXISTS user_cuppings (
  id TEXT PRIMARY KEY, owner TEXT NOT NULL, bean_id TEXT, coffee_id TEXT REFERENCES ref_coffees(id),
  cupped_at TEXT NOT NULL, fragrance REAL, flavor REAL, aftertaste REAL, acidity REAL, body REAL,
  balance REAL, uniformity REAL, clean_cup REAL, sweetness REAL, overall REAL, defects INTEGER DEFAULT 0,
  total_score REAL, notes TEXT, shared INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cuppings_owner ON user_cuppings(owner);
CREATE INDEX IF NOT EXISTS idx_cuppings_bean  ON user_cuppings(bean_id);
CREATE TABLE IF NOT EXISTS user_cupping_flavors (
  cupping_id TEXT NOT NULL REFERENCES user_cuppings(id), flavor_id TEXT NOT NULL REFERENCES ref_flavors(id),
  intensity INTEGER, PRIMARY KEY (cupping_id, flavor_id)
);

-- ====================================================================
-- WATER CONCENTRATE CATALOG (reference layer for the brew-water calculator)
-- Mirrors the ref_* trust model: curated brands/drops + a salt glossary, every
-- row provenance-tagged. The calculator's hardcoded TONIK/JAMM/LYLAC become
-- rows here; user-defined drops live in user_drops (owner-scoped, like recipes).
-- ====================================================================

-- ── Salt glossary: chemistry + plain-language explainers (curated) ──
-- mm = molar mass g/mol; ca/mg/hco3 = ions per formula unit (drives GH/KH).
CREATE TABLE IF NOT EXISTS ref_salts (
  key TEXT PRIMARY KEY,             -- 'mgcl2' (matches the calculator's salt keys)
  formula TEXT NOT NULL,            -- 'MgCl₂'
  name TEXT NOT NULL,               -- 'Magnesium chloride'
  mm REAL NOT NULL,                 -- molar mass g/mol
  ca INTEGER NOT NULL DEFAULT 0, mg INTEGER NOT NULL DEFAULT 0, hco3 INTEGER NOT NULL DEFAULT 0,
  contributes TEXT,                 -- 'GH' (hardness) | 'KH' (alkalinity) | 'neutral'
  ion TEXT,                         -- headline ion: 'Mg' | 'Ca' | 'HCO3' | 'Na' | 'K' | 'Si'
  flavor TEXT,                      -- one-line sensory effect
  explainer TEXT,                   -- longer plain-language description
  source TEXT, source_url TEXT, updated_at TEXT NOT NULL
);

-- ── Brands (curated taxonomy) ──
CREATE TABLE IF NOT EXISTS ref_drop_brands (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, blurb TEXT, website TEXT,
  source TEXT, source_url TEXT, confidence TEXT NOT NULL DEFAULT 'medium', updated_at TEXT NOT NULL
);

-- ── Drops: one bottle / component / profile in the catalog ──
-- A "kit" you blend = the set of drops sharing a brand_id. dose_model says how a
-- drop is dosed: 'gl' (g/L of concentrate, blended by ratio — Apax) or
-- 'ppm_per_drop' (brand-calibrated dropper, exact — Lotus). provenance grades the
-- composition data: 'exact' (published amounts) | 'labeled' (ingredient list order,
-- amounts estimated) | 'published-profile' (target ppm published) | 'estimated'.
CREATE TABLE IF NOT EXISTS ref_drops (
  id TEXT PRIMARY KEY,
  brand_id TEXT REFERENCES ref_drop_brands(id),
  name TEXT NOT NULL,               -- 'TONIK'
  tag TEXT,                         -- short badge '[1]'
  note TEXT,                        -- profile blurb 'acidity · clarity'
  color TEXT,                       -- accent (CSS var or hex)
  ingredients TEXT,                 -- JSON ordered array of salt keys (label order = descending weight)
  comp TEXT,                        -- JSON { salt_key: weight_fraction } — estimated or exact
  dose_model TEXT NOT NULL DEFAULT 'gl',  -- 'gl' | 'ppm_per_drop'
  dose_json TEXT,                   -- model params, e.g. {"ml_ref":450,"ppm_per_drop":10} for Lotus
  provenance TEXT NOT NULL DEFAULT 'labeled',
  sort INTEGER NOT NULL DEFAULT 0,
  source TEXT, source_url TEXT, confidence TEXT NOT NULL DEFAULT 'medium', updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_drops_brand ON ref_drops(brand_id);

-- ── User-defined drops (owner-scoped; opt-in shareable like recipes) ──
CREATE TABLE IF NOT EXISTS user_drops (
  id TEXT PRIMARY KEY, owner TEXT NOT NULL, name TEXT NOT NULL, note TEXT, color TEXT,
  comp TEXT,                        -- JSON { salt_key: weight_fraction }
  dose_model TEXT NOT NULL DEFAULT 'gl', dose_json TEXT,
  shared INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_drops_owner ON user_drops(owner);

-- ── Brew gear (curated reference; same trust model as ref_salts/ref_drops) ──
-- The pour-over half of a recipe: dripper + filter + grinder, modelled BRAND → MODEL
-- (a brand like Hario/Orea/Kalita has many distinct models). `icon` is a PRESS icon
-- name derived from the type; `type` drives grouping + the icon. Sourced from a
-- multi-source research pass (manufacturer sites + reputable guides), provenance-tagged.
CREATE TABLE IF NOT EXISTS ref_brewers (
  id TEXT PRIMARY KEY,              -- slug 'hario-v60-ceramic-02'
  brand TEXT NOT NULL,              -- 'Hario'
  model TEXT NOT NULL,              -- 'V60 Ceramic Dripper 02'
  type TEXT,                        -- conical|flat-bottom|wave|hybrid|hybrid-flat-bed|immersion|switch|siphon|moka|percolator|batch
  filter_format TEXT,              -- compatible filter format ('V60-02','Kalita-Wave-185',…)
  icon TEXT,                        -- PRESS icon name (derived from type)
  signature TEXT,                   -- one-line cup/flow signature
  discontinued INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  source TEXT, confidence TEXT NOT NULL DEFAULT 'medium', updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_brewers_brand ON ref_brewers(brand);
CREATE TABLE IF NOT EXISTS ref_filters (
  id TEXT PRIMARY KEY,              -- slug 'cafec-abaca-cone-02'
  brand TEXT NOT NULL,              -- 'Cafec'
  model TEXT NOT NULL,              -- 'Abaca Cone Cup4 (02)'
  format TEXT,                      -- 'V60-02','Kalita-Wave-185','Chemex','AeroPress','flat-S'…
  material TEXT,                    -- bleached-paper|unbleached-paper|abaca|cloth|metal
  icon TEXT,                        -- PRESS icon name
  trait TEXT,                       -- notable trait (flow/thickness)
  discontinued INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  source TEXT, confidence TEXT NOT NULL DEFAULT 'medium', updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_filters_brand ON ref_filters(brand);
CREATE TABLE IF NOT EXISTS ref_grinders (
  id TEXT PRIMARY KEY,              -- slug 'comandante-c40-mk4'
  brand TEXT NOT NULL,              -- 'Comandante'
  model TEXT NOT NULL,              -- 'C40 MK4'
  hand_electric TEXT,               -- 'hand' | 'electric'
  burr_type TEXT,                   -- 'conical' | 'flat'
  burr_mm TEXT,                     -- '39'
  icon TEXT,                        -- PRESS icon name
  known_for TEXT,                   -- 'pour-over'|'espresso'|'all-round' + note
  discontinued INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  source TEXT, confidence TEXT NOT NULL DEFAULT 'medium', updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_grinders_brand ON ref_grinders(brand);

-- ── Enrichment infrastructure ──
CREATE TABLE IF NOT EXISTS enrich_cache (
  input_hash TEXT PRIMARY KEY, input_text TEXT NOT NULL, result_json TEXT NOT NULL,
  model TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS enrich_facts (
  id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT, field TEXT NOT NULL, value TEXT,
  source TEXT, source_url TEXT, confidence TEXT NOT NULL DEFAULT 'low',
  status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_facts_entity ON enrich_facts(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_facts_status ON enrich_facts(status);

-- ── Graph ingestion staging (entity-level candidate gate) ──
-- Bulk imports and new entities from user logs can land here as 'pending' before
-- promotion into ref_*. The confidence-gated upsert (upsertEntity) never clobbers
-- a higher-confidence value, so trusted bulk can promote straight through; this
-- queue is for the ambiguous / low-trust *new* entities a human should eyeball first.
CREATE TABLE IF NOT EXISTS staging_entities (
  id          TEXT PRIMARY KEY,                 -- staging row id
  entity_type TEXT NOT NULL,                    -- 'producer' | 'coffee' | 'roaster'
  payload     TEXT NOT NULL,                    -- JSON of proposed canonical fields
  match_id    TEXT,                             -- resolved canonical id, if the resolver found one
  match_score REAL NOT NULL DEFAULT 0,          -- 0..1 resolver confidence
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | promoted | rejected
  source      TEXT NOT NULL,
  source_url  TEXT,
  confidence  TEXT NOT NULL DEFAULT 'low',      -- firsthand | high | medium | low | estimated
  note        TEXT,
  created_at  TEXT NOT NULL,
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_staging_status ON staging_entities(status, entity_type);

-- Per-user gear favorites (brewer/filter/grinder) — float to the top of each picker.
CREATE TABLE IF NOT EXISTS user_favorites (
  owner TEXT NOT NULL, kind TEXT NOT NULL, ref_id TEXT NOT NULL, created_at TEXT NOT NULL,
  PRIMARY KEY (owner, kind, ref_id)
);
