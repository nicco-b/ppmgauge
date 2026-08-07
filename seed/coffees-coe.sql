-- seed :: producers + real Cup of Excellence lots
-- -> ref_producers, ref_coffees, ref_coffee_varieties, ref_coffee_flavors
--
-- COE lots below were FETCHED from the public Cup of Excellence Farm Directory
-- (farmdirectory.cupofexcellence.org) — each row carries its source_url and is
-- marked confidence='high' (single authoritative source, not cross-verified).
-- The two famous estates (Esmeralda, El Injerto) are from widely-documented
-- general knowledge, marked confidence='medium' — verify before relying on them.
-- This is the trust discipline made literal: every row says where it came from.


-- ── Producers ──────────────────────────────────────────────────────
INSERT OR REPLACE INTO ref_producers
 (id,name,kind,country_code,region_id,owner,founded,hectares,altitude_min_m,altitude_max_m,lat,lng,story,photo_keys,website,source,source_url,confidence,fetched_at,updated_at) VALUES
 ('la-bohemia-co','La Bohemia','farm','CO',NULL,'Raquel Lasso Muñoz',NULL,NULL,NULL,NULL,NULL,NULL,
  'Colombian smallholder farm; placed 5th in the 2023 Colombia Cup of Excellence with a washed Geisha (89.78). Cup profile: floral, caramel, silky body.',
  NULL,NULL,'cup_of_excellence','https://farmdirectory.cupofexcellence.org/listing/5-la-bohemia-colombia-2023/','high','2026-05-31','2026-05-31'),
 ('pocitos-mx','Pocitos','farm','MX',NULL,'Jesus Carlos Cadena Valdivia',NULL,NULL,1350,1400,NULL,NULL,
  'Farm in Veracruz, Mexico; a natural Geisha that scored 90.66 in Mexico Cup of Excellence.',
  NULL,NULL,'cup_of_excellence','https://farmdirectory.cupofexcellence.org/listing/1-pocitos-mexico-2024-experimental/','high','2026-05-31','2026-05-31'),
 ('shimelis-obise-mamo-et','Shimelis Obise Mamo','farm','ET',NULL,'Shimelis Obise Mamo',NULL,NULL,NULL,NULL,NULL,NULL,
  'Ethiopian producer; National Winner in the 2021 Ethiopia Cup of Excellence with a natural-process 74112 (86.88).',
  NULL,NULL,'cup_of_excellence','https://farmdirectory.cupofexcellence.org/listing/shimelis-obise-mamo-ethiopia-2021/','high','2026-05-31','2026-05-31'),
 ('hacienda-la-esmeralda-pa','Hacienda La Esmeralda','estate','PA','pa-boquete','Peterson family',NULL,NULL,1500,1800,NULL,NULL,
  'Boquete, Panama. The estate that introduced Panamanian Geisha to the specialty world in 2004, repeatedly setting auction records and defining the modern Geisha phenomenon.',
  NULL,'https://haciendaesmeralda.com','general_knowledge',NULL,'medium','2026-05-31','2026-05-31'),
 ('finca-el-injerto-gt','Finca El Injerto','estate','GT','gt-huehuetenango','Aguirre family',NULL,NULL,1500,2000,NULL,NULL,
  'Huehuetenango, Guatemala. A historic estate and multiple Cup of Excellence winner known for Bourbon, Pacamara and Geisha lots.',
  NULL,'https://elinjerto.com','general_knowledge',NULL,'medium','2026-05-31','2026-05-31');

-- ── Coffees / lots ─────────────────────────────────────────────────
INSERT OR REPLACE INTO ref_coffees
 (id,name,roaster_id,producer_id,importer_id,country_code,region_id,process_id,crop_year,lot_number,roast_level,published_score,score_source,price,currency,weight_g,url,source,source_url,confidence,ingested_at) VALUES
 ('coe-co-2023-labohemia','La Bohemia — Geisha Washed',NULL,'la-bohemia-co',NULL,'CO',NULL,'washed','2023',NULL,NULL,
  89.78,'cup_of_excellence_colombia_2023',NULL,NULL,NULL,
  'https://farmdirectory.cupofexcellence.org/listing/5-la-bohemia-colombia-2023/','cup_of_excellence','https://farmdirectory.cupofexcellence.org/listing/5-la-bohemia-colombia-2023/','high','2026-05-31'),
 ('coe-mx-2024-pocitos','Pocitos — Geisha Natural',NULL,'pocitos-mx',NULL,'MX',NULL,'natural','2024',NULL,NULL,
  90.66,'cup_of_excellence_mexico_2024',NULL,NULL,NULL,
  'https://farmdirectory.cupofexcellence.org/listing/1-pocitos-mexico-2024-experimental/','cup_of_excellence','https://farmdirectory.cupofexcellence.org/listing/1-pocitos-mexico-2024-experimental/','high','2026-05-31'),
 ('coe-et-2021-shimelis','Shimelis Obise Mamo — 74112 Natural',NULL,'shimelis-obise-mamo-et',NULL,'ET',NULL,'natural','2021',NULL,NULL,
  86.88,'cup_of_excellence_ethiopia_2021',NULL,NULL,NULL,
  'https://farmdirectory.cupofexcellence.org/listing/shimelis-obise-mamo-ethiopia-2021/','cup_of_excellence','https://farmdirectory.cupofexcellence.org/listing/shimelis-obise-mamo-ethiopia-2021/','high','2026-05-31');

-- ── Coffee ↔ variety ───────────────────────────────────────────────
INSERT OR REPLACE INTO ref_coffee_varieties (coffee_id,variety_id) VALUES
 ('coe-co-2023-labohemia','gesha'),
 ('coe-mx-2024-pocitos','gesha'),
 ('coe-et-2021-shimelis','ethiopian-landrace');   -- 74112 is a WCR/JARC selection of Ethiopian landrace

-- ── Coffee ↔ flavor (PUBLISHED notes — calibration baseline) ───────
-- La Bohemia directory note: floral, caramel, fruit-forward.
INSERT OR REPLACE INTO ref_coffee_flavors (coffee_id,flavor_id) VALUES
 ('coe-co-2023-labohemia','floral-floral'),
 ('coe-co-2023-labohemia','sweet-caramelized'),
 ('coe-co-2023-labohemia','fruity-other');

