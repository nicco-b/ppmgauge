-- seed :: more real Cup of Excellence lots (batch 2)
-- Fetched from farmdirectory.cupofexcellence.org — every row carries source_url,
-- confidence='high' (single authoritative source). Load AFTER coffees-coe.sql.


-- ── Producers ──────────────────────────────────────────────────────
INSERT OR REPLACE INTO ref_producers
 (id,name,kind,country_code,region_id,owner,founded,hectares,altitude_min_m,altitude_max_m,lat,lng,story,photo_keys,website,source,source_url,confidence,fetched_at,updated_at) VALUES
 ('la-bola-pe','La Bola','farm','PE',NULL,'Blanca Flor Cordova Jimenez',NULL,NULL,NULL,NULL,NULL,NULL,
  'Peruvian farm; took 1st (rank 1A, 90.39) in the 2022 Peru Cup of Excellence with a washed Geisha.',
  NULL,NULL,'cup_of_excellence','https://farmdirectory.cupofexcellence.org/listing/1a-la-bola-peru-2022/','high','2026-05-31','2026-05-31'),
 ('la-fortuna-co','La Fortuna','farm','CO',NULL,'Victor Feliz Ramirez Cruz',NULL,NULL,NULL,NULL,NULL,NULL,
  'Colombian farm; placed 10th (88.39) in the 2021 Colombia Cup of Excellence with a washed Geisha. Cup: floral, brown sugar, caramel, green tea, mandarin, red grape; bright citric acidity.',
  NULL,NULL,'cup_of_excellence','https://farmdirectory.cupofexcellence.org/listing/la-fortuna-colombia-2021/','high','2026-05-31','2026-05-31');

-- ── Coffees / lots ─────────────────────────────────────────────────
INSERT OR REPLACE INTO ref_coffees
 (id,name,roaster_id,producer_id,importer_id,country_code,region_id,process_id,crop_year,lot_number,roast_level,published_score,score_source,price,currency,weight_g,url,source,source_url,confidence,ingested_at) VALUES
 ('coe-pe-2022-labola','La Bola — Geisha Washed',NULL,'la-bola-pe',NULL,'PE',NULL,'washed','2022',NULL,NULL,
  90.39,'cup_of_excellence_peru_2022',NULL,NULL,NULL,
  'https://farmdirectory.cupofexcellence.org/listing/1a-la-bola-peru-2022/','cup_of_excellence','https://farmdirectory.cupofexcellence.org/listing/1a-la-bola-peru-2022/','high','2026-05-31'),
 ('coe-co-2021-lafortuna','La Fortuna — Geisha Washed',NULL,'la-fortuna-co',NULL,'CO',NULL,'washed','2021',NULL,NULL,
  88.39,'cup_of_excellence_colombia_2021',NULL,NULL,NULL,
  'https://farmdirectory.cupofexcellence.org/listing/la-fortuna-colombia-2021/','cup_of_excellence','https://farmdirectory.cupofexcellence.org/listing/la-fortuna-colombia-2021/','high','2026-05-31');

-- ── Coffee ↔ variety ───────────────────────────────────────────────
INSERT OR REPLACE INTO ref_coffee_varieties (coffee_id,variety_id) VALUES
 ('coe-pe-2022-labola','gesha'),
 ('coe-co-2021-lafortuna','gesha');

-- ── Coffee ↔ flavor (published notes — only nodes that exist in the wheel) ──
-- La Fortuna directory notes mapped to ref_flavors ids (green tea has no wheel node, omitted).
INSERT OR REPLACE INTO ref_coffee_flavors (coffee_id,flavor_id) VALUES
 ('coe-co-2021-lafortuna','floral-floral'),
 ('coe-co-2021-lafortuna','sweet-brown-sugar'),
 ('coe-co-2021-lafortuna','sweet-caramelized'),
 ('coe-co-2021-lafortuna','floral-black-tea'),
 ('coe-co-2021-lafortuna','fruity-orange'),
 ('coe-co-2021-lafortuna','fruity-grape'),
 ('coe-co-2021-lafortuna','fruity-grapefruit'),
 ('coe-co-2021-lafortuna','fruity-lemon'),
 ('coe-co-2021-lafortuna','fruity-lime'),
 ('coe-co-2021-lafortuna','nc-almond');

