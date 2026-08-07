-- seed :: non-Geisha Cup of Excellence lots (batch 3) — variety/process range
-- for calibration. Fetched from farmdirectory.cupofexcellence.org (source_url +
-- confidence='high' per row). Adds Nicaragua (was missing) + two varieties
-- (Maracaturra, Bernardina) the lots need. Load AFTER coffees-coe-2.sql.
-- FK order within file: country → varieties → lineage → producers → coffees → links.

-- ── Nicaragua (producing country — was absent) ──
INSERT OR REPLACE INTO ref_countries (code,name,continent,hemisphere,aliases,updated_at) VALUES
 ('NI','Nicaragua','North America','N','[]','2026-05-31');
INSERT OR REPLACE INTO ref_harvest_windows (id,country_code,label,start_month,end_month,notes) VALUES
 ('ni-main','NI','main crop',11,2,NULL);

-- ── New varieties the lots reference ──
INSERT OR REPLACE INTO ref_varieties
 (id,name,species,lineage,optimal_alt_min_m,optimal_alt_max_m,yield_potential,rust_resistance,bean_size,flavor_potential,notes,aliases,source,source_url,updated_at) VALUES
 ('maracaturra','Maracaturra','arabica','Maragogipe × Caturra',1100,1700,'medium','susceptible','very large','Good to very good; large bean, juicy sweetness','Natural cross of Maragogipe and Caturra; giant beans, popular in Nicaragua.','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/','2026-05-31'),
 ('bernardina','Bernardina','arabica','Natural mutation (El Salvador)',1300,1700,'low','susceptible','medium','Exceptional; floral and complex, esp. natural-processed','Distinctive mutation found in El Salvador; recently prominent in competitions.','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/','2026-05-31');

INSERT OR REPLACE INTO ref_variety_lineage (parent_id,child_id,relation) VALUES
 ('maragogipe','maracaturra','cross'),
 ('caturra','maracaturra','cross');

-- ── Producers ──
INSERT OR REPLACE INTO ref_producers
 (id,name,kind,country_code,region_id,owner,founded,hectares,altitude_min_m,altitude_max_m,lat,lng,story,photo_keys,website,source,source_url,confidence,fetched_at,updated_at) VALUES
 ('santa-isabel-gt','Santa Isabel','farm','GT',NULL,'Agricola Valmar, S.A.',NULL,NULL,1500,1500,NULL,NULL,
  'San Cristóbal Verapaz, Alta Verapaz, Guatemala. Guatemala 2022 National Winner with a washed Caturra (86.27).',
  NULL,NULL,'cup_of_excellence','https://farmdirectory.cupofexcellence.org/listing/santa-isabel-86-27-guatemala-2022-national-winner/','high','2026-05-31','2026-05-31'),
 ('el-chele-ni','El Chele','farm','NI',NULL,'Norman Alexander Torres Rivera',NULL,NULL,1200,1350,NULL,NULL,
  'Datanli natural reserve, Nicaragua. Placed 20th in the 2022 Nicaragua Cup of Excellence with a natural Catuaí Rojo (87.26).',
  NULL,NULL,'cup_of_excellence','https://farmdirectory.cupofexcellence.org/listing/20-el-chele-nicaragua-2022-cup-of-excellence/','high','2026-05-31','2026-05-31'),
 ('santa-juana-sv','Santa Juana','farm','SV',NULL,'Pacvil S.A. de C.V.',NULL,NULL,NULL,NULL,NULL,NULL,
  'Apaneca-Ilamatepec range, El Salvador. Placed 11th in the 2022 El Salvador Cup of Excellence with a natural Bernardina (88.57).',
  NULL,NULL,'cup_of_excellence','https://farmdirectory.cupofexcellence.org/listing/11-santa-juana-el-salvador-2022/','high','2026-05-31','2026-05-31'),
 ('un-regalo-de-dios-ni','Un Regalo de Dios','farm','NI',NULL,'Luis Alberto Balladarez Moncada',NULL,NULL,1350,1680,NULL,NULL,
  'Nueva Segovia (Mozonte), Nicaragua. 3rd in the 2022 Nicaragua Cup of Excellence with a natural Maracaturra (89.53). Cup: honey, milk chocolate, orange, peach, caramel, lychee.',
  NULL,NULL,'cup_of_excellence','https://farmdirectory.cupofexcellence.org/listing/3-un-regalo-de-dios-nicaragua-2022-cup-of-excellence/','high','2026-05-31','2026-05-31');

-- ── Coffees / lots ──
INSERT OR REPLACE INTO ref_coffees
 (id,name,roaster_id,producer_id,importer_id,country_code,region_id,process_id,crop_year,lot_number,roast_level,published_score,score_source,price,currency,weight_g,url,source,source_url,confidence,ingested_at) VALUES
 ('coe-gt-2022-santaisabel','Santa Isabel — Caturra Washed',NULL,'santa-isabel-gt',NULL,'GT',NULL,'washed','2022',NULL,NULL,
  86.27,'cup_of_excellence_guatemala_2022',NULL,NULL,NULL,
  'https://farmdirectory.cupofexcellence.org/listing/santa-isabel-86-27-guatemala-2022-national-winner/','cup_of_excellence','https://farmdirectory.cupofexcellence.org/listing/santa-isabel-86-27-guatemala-2022-national-winner/','high','2026-05-31'),
 ('coe-ni-2022-elchele','El Chele — Catuaí Natural',NULL,'el-chele-ni',NULL,'NI',NULL,'natural','2022',NULL,NULL,
  87.26,'cup_of_excellence_nicaragua_2022',NULL,NULL,NULL,
  'https://farmdirectory.cupofexcellence.org/listing/20-el-chele-nicaragua-2022-cup-of-excellence/','cup_of_excellence','https://farmdirectory.cupofexcellence.org/listing/20-el-chele-nicaragua-2022-cup-of-excellence/','high','2026-05-31'),
 ('coe-sv-2022-santajuana','Santa Juana — Bernardina Natural',NULL,'santa-juana-sv',NULL,'SV',NULL,'natural','2022',NULL,NULL,
  88.57,'cup_of_excellence_el_salvador_2022',NULL,NULL,NULL,
  'https://farmdirectory.cupofexcellence.org/listing/11-santa-juana-el-salvador-2022/','cup_of_excellence','https://farmdirectory.cupofexcellence.org/listing/11-santa-juana-el-salvador-2022/','high','2026-05-31'),
 ('coe-ni-2022-unregalo','Un Regalo de Dios — Maracaturra Natural',NULL,'un-regalo-de-dios-ni',NULL,'NI',NULL,'natural','2022',NULL,NULL,
  89.53,'cup_of_excellence_nicaragua_2022',NULL,NULL,NULL,
  'https://farmdirectory.cupofexcellence.org/listing/3-un-regalo-de-dios-nicaragua-2022-cup-of-excellence/','cup_of_excellence','https://farmdirectory.cupofexcellence.org/listing/3-un-regalo-de-dios-nicaragua-2022-cup-of-excellence/','high','2026-05-31');

-- ── Coffee ↔ variety ──
INSERT OR REPLACE INTO ref_coffee_varieties (coffee_id,variety_id) VALUES
 ('coe-gt-2022-santaisabel','caturra'),
 ('coe-ni-2022-elchele','catuai'),
 ('coe-sv-2022-santajuana','bernardina'),
 ('coe-ni-2022-unregalo','maracaturra');

-- ── Coffee ↔ flavor (published notes — Un Regalo had a full profile; wheel nodes only) ──
INSERT OR REPLACE INTO ref_coffee_flavors (coffee_id,flavor_id) VALUES
 ('coe-ni-2022-unregalo','nc-chocolate'),
 ('coe-ni-2022-unregalo','sweet-honey'),
 ('coe-ni-2022-unregalo','sweet-overall'),
 ('coe-ni-2022-unregalo','sweet-caramelized'),
 ('coe-ni-2022-unregalo','fruity-orange'),
 ('coe-ni-2022-unregalo','fruity-peach'),
 ('coe-ni-2022-unregalo','fruity-citrus');
