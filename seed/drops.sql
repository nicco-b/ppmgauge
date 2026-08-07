-- Water concentrate catalog + salt glossary (see ../schema.sql).
--
-- PROVENANCE NOTES (this is a scientific tool — data is graded, not guessed):
--  · Salt chemistry (molar mass, ion counts) is exact textbook stoichiometry.
--  · Salt *explainers* follow Hendon & Colonna-Dashwood, "Water for Coffee" and
--    the SCA Water Standard — established coffee-water chemistry.
--  · Apax drops: the INGREDIENT LIST is from the published labels (legally ordered
--    by descending weight, so even the order is real); the weight FRACTIONS are
--    estimates → provenance 'labeled'. Calibration refines them per bottle.
--  · Lotus drops: single-salt bottles with a PUBLISHED per-drop dose (10 ppm/drop
--    chlorides, 5 ppm/drop bicarbonates per 450 mL) → provenance 'exact'.
--  · Third Wave Water: complete profiles; only target ppm is published, amounts are
--    proprietary → provenance 'published-profile', reference-only (not a blend kit).
--
-- Idempotent (INSERT OR REPLACE on PKs). Depends only on ../schema.sql.

-- ── Salt glossary ─────────────────────────────────────────────────────────────
INSERT OR REPLACE INTO ref_salts (key,formula,name,mm,ca,mg,hco3,contributes,ion,flavor,explainer,source,source_url,updated_at) VALUES
 ('mgcl2','MgCl₂','Magnesium chloride',95.21,0,1,0,'GH','Mg','juicy · fruit · aromatic complexity',
  'Magnesium hardness carried on a flavour-neutral chloride. Magnesium binds the compounds coffee extraction targets, so it tends to pull out fruit, acidity and aromatic complexity — often described as "juicy". Very soluble; raises GH (hardness), no buffering.',
  'Hendon & Colonna-Dashwood, Water for Coffee; SCA Water Standard','https://apaxlab.com','2026-06-01T00:00:00Z'),
 ('mgso4','MgSO₄','Magnesium sulfate (Epsom salt)',120.37,0,1,0,'GH','Mg','florals · body · crisp brightness',
  'Magnesium plus sulfate. Like MgCl₂ it raises hardness and lifts aromatics and body, but the sulfate ion adds a crisp, slightly dry edge that sharpens perceived brightness. Raises GH (hardness), no buffering.',
  'Hendon & Colonna-Dashwood, Water for Coffee','https://apaxlab.com','2026-06-01T00:00:00Z'),
 ('cacl2','CaCl₂','Calcium chloride',110.98,1,0,0,'GH','Ca','structure · clarity · clean sweetness',
  'Calcium hardness. Calcium extracts efficiently and is associated with "structure", clarity and a clean accenting of sweetness. Very soluble and hygroscopic. Raises GH (hardness), no buffering.',
  'Hendon & Colonna-Dashwood, Water for Coffee; SCA Water Standard','https://apaxlab.com','2026-06-01T00:00:00Z'),
 ('khco3','KHCO₃','Potassium bicarbonate',100.12,0,0,1,'KH','HCO3','buffers acidity · lets fruit show',
  'A bicarbonate buffer carried on potassium. Bicarbonate is alkalinity (KH): it raises pH and neutralises the acids extracted from coffee, taming sourness. The potassium counter-ion is often said to let fruit read more clearly than sodium does.',
  'Hendon & Colonna-Dashwood, Water for Coffee; Lotus Coffee Products','https://lotuscoffeeproducts.com/pages/faq','2026-06-01T00:00:00Z'),
 ('nahco3','NaHCO₃','Sodium bicarbonate (baking soda)',84.01,0,0,1,'KH','HCO3','buffers acidity · smooth · rounds',
  'A bicarbonate buffer carried on sodium. Same alkalinity/KH role as KHCO₃ — buffers acidity and raises pH — but the sodium counter-ion rounds and smooths the cup and can blunt bitterness in darker roasts.',
  'Hendon & Colonna-Dashwood, Water for Coffee; Lotus Coffee Products','https://lotuscoffeeproducts.com/pages/faq','2026-06-01T00:00:00Z'),
 ('kcl','KCl','Potassium chloride',74.55,0,0,0,'neutral','K','saline roundness · no hardness',
  'Potassium with a neutral chloride. Adds no hardness and no buffering, so it shifts the mineral and flavour balance — a touch of saline roundness and perceived sweetness — without moving GH or KH.',
  'Hendon & Colonna-Dashwood, Water for Coffee','https://apaxlab.com','2026-06-01T00:00:00Z'),
 ('nacl','NaCl','Sodium chloride (table salt)',58.44,0,0,0,'neutral','Na','cuts bitterness · lifts sweetness',
  'Sodium with a neutral chloride. No hardness, no buffering. In trace amounts sodium suppresses bitterness and lifts perceived sweetness; too much reads salty.',
  'Hendon & Colonna-Dashwood, Water for Coffee','https://apaxlab.com','2026-06-01T00:00:00Z'),
 ('sio2','SiO₂','Silica',60.08,0,0,0,'neutral','Si','silky mouthfeel · inert',
  'Contributes to mouthfeel — a silky, slightly viscous texture — and is effectively inert toward hardness and alkalinity (it is not a GH or KH ion), so it shapes how the water feels more than how it extracts.',
  'Apax Lab (KONFLUX ingredients)','https://apaxlab.com/products/konflux-sample','2026-06-01T00:00:00Z');

-- ── Brands ────────────────────────────────────────────────────────────────────
INSERT OR REPLACE INTO ref_drop_brands (id,name,blurb,website,source,source_url,confidence,updated_at) VALUES
 ('apax','Apax Lab','Analytical-reagent-grade single-profile concentrates you blend by ratio to shape how coffee is perceived.','https://apaxlab.com','apaxlab.com product labels','https://apaxlab.com','high','2026-06-01T00:00:00Z'),
 ('lotus','Lotus Coffee Products','Four single-salt mineral drops dosed by the drop, with a published per-drop ppm.','https://lotuscoffeeproducts.com','lotuscoffeeproducts.com + Scott Rao','https://lotuscoffeeproducts.com/pages/faq','high','2026-06-01T00:00:00Z'),
 ('tww','Third Wave Water','Pre-measured mineral profiles — a complete brewing water in one packet (amounts proprietary).','https://thirdwavewater.com','thirdwavewater.com published profiles','https://thirdwavewater.com','medium','2026-06-01T00:00:00Z');

-- ── Apax drops (ingredients real, fractions estimated → 'labeled') ────────────
INSERT OR REPLACE INTO ref_drops (id,brand_id,name,tag,note,color,ingredients,comp,dose_model,dose_json,provenance,sort,source,source_url,confidence,updated_at) VALUES
 ('apax_tonik','apax','TONIK','[1]','acidity · clarity','var(--cad-yellow)',
  '["mgcl2","cacl2","nacl","nahco3","khco3"]',
  '{"mgcl2":0.40,"cacl2":0.30,"nacl":0.12,"nahco3":0.10,"khco3":0.08}',
  'gl',NULL,'labeled',1,'apaxlab.com ingredient list','https://apaxlab.com','high','2026-06-01T00:00:00Z'),
 ('apax_jamm','apax','JAMM','[2]','sweetness · body','var(--cad-red)',
  '["mgcl2","cacl2","kcl","khco3","nahco3"]',
  '{"mgcl2":0.22,"cacl2":0.30,"kcl":0.10,"khco3":0.20,"nahco3":0.18}',
  'gl',NULL,'labeled',2,'apaxlab.com ingredient list','https://apaxlab.com','high','2026-06-01T00:00:00Z'),
 ('apax_lylac','apax','LYLAC','[3]','floral · magnesium','var(--cad-violet)',
  '["mgso4","mgcl2","kcl","khco3","nahco3","nacl"]',
  '{"mgso4":0.35,"mgcl2":0.20,"kcl":0.18,"khco3":0.12,"nahco3":0.08,"nacl":0.07}',
  'gl',NULL,'labeled',3,'apaxlab.com ingredient list','https://apaxlab.com','high','2026-06-01T00:00:00Z'),
 ('apax_konflux','apax','KONFLUX','[4]','mouthfeel · depth','var(--cad-cerulean)',
  '["cacl2","kcl","nacl","sio2","khco3","nahco3"]',
  '{"cacl2":0.34,"kcl":0.18,"nacl":0.14,"sio2":0.10,"khco3":0.14,"nahco3":0.10}',
  'gl',NULL,'labeled',4,'apaxlab.com KONFLUX ingredient list','https://apaxlab.com/products/konflux-sample','high','2026-06-01T00:00:00Z');

-- ── Lotus drops (single-salt, PUBLISHED per-drop dose → 'exact') ──────────────
-- dose_json: ppm_per_drop = mg/L of that salt added by one drop in ml_ref of water.
INSERT OR REPLACE INTO ref_drops (id,brand_id,name,tag,note,color,ingredients,comp,dose_model,dose_json,provenance,sort,source,source_url,confidence,updated_at) VALUES
 ('lotus_calcium','lotus','Calcium','Ca','hardness · structure','var(--cad-yellow)',
  '["cacl2"]','{"cacl2":1.0}','ppm_per_drop','{"ml_ref":450,"ppm_per_drop":10}','exact',1,
  'lotuscoffeeproducts.com FAQ','https://lotuscoffeeproducts.com/pages/faq','high','2026-06-01T00:00:00Z'),
 ('lotus_magnesium','lotus','Magnesium','Mg','hardness · complexity','var(--cad-violet)',
  '["mgcl2"]','{"mgcl2":1.0}','ppm_per_drop','{"ml_ref":450,"ppm_per_drop":10}','exact',2,
  'lotuscoffeeproducts.com FAQ','https://lotuscoffeeproducts.com/pages/faq','high','2026-06-01T00:00:00Z'),
 ('lotus_alk_k','lotus','Potassium bicarbonate','KH','alkalinity · buffer','var(--positive)',
  '["khco3"]','{"khco3":1.0}','ppm_per_drop','{"ml_ref":450,"ppm_per_drop":5}','exact',3,
  'lotuscoffeeproducts.com FAQ','https://lotuscoffeeproducts.com/pages/faq','high','2026-06-01T00:00:00Z'),
 ('lotus_alk_na','lotus','Sodium bicarbonate','KH','alkalinity · smooth','var(--cad-cerulean)',
  '["nahco3"]','{"nahco3":1.0}','ppm_per_drop','{"ml_ref":450,"ppm_per_drop":5}','exact',4,
  'lotuscoffeeproducts.com FAQ','https://lotuscoffeeproducts.com/pages/faq','high','2026-06-01T00:00:00Z');

-- ── Third Wave Water (complete profiles; reference-only → 'published-profile') ─
-- dose_model 'profile' = a finished water, not a blend component. Only target ppm
-- is published; exact mineral amounts are proprietary, so comp is intentionally NULL.
INSERT OR REPLACE INTO ref_drops (id,brand_id,name,tag,note,color,ingredients,comp,dose_model,dose_json,provenance,sort,source,source_url,confidence,updated_at) VALUES
 ('tww_classic','tww','Classic','★','balanced · all-purpose','var(--cad-yellow)',
  '["mgso4","cacl2","nahco3"]',NULL,'profile','{"profile_ppm":{"note":"Mg + Ca + a touch of Na","tds":"~140"}}','published-profile',1,
  'thirdwavewater.com (amounts proprietary)','https://thirdwavewater.com','medium','2026-06-01T00:00:00Z'),
 ('tww_light','tww','Classic Light Roast','☼','light roast · high magnesium','var(--cad-violet)',
  '["mgso4","cacl2","nahco3"]',NULL,'profile','{"profile_ppm":{"note":"Highest magnesium of the range","tds":"~90-100"}}','published-profile',2,
  'thirdwavewater.com (amounts proprietary)','https://thirdwavewater.com','medium','2026-06-01T00:00:00Z'),
 ('tww_espresso','tww','Espresso','◉','espresso machines · with buffer','var(--cad-red)',
  '["mgso4","cacl2","khco3"]',NULL,'profile','{"profile_ppm":{"note":"Mg + Ca + potassium bicarbonate buffer","tds":"~85-95"}}','published-profile',3,
  'thirdwavewater.com (amounts proprietary)','https://thirdwavewater.com','medium','2026-06-01T00:00:00Z');
