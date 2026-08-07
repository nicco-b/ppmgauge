-- seed :: producing countries + harvest windows + signature regions
-- -> ref_countries, ref_harvest_windows, ref_regions
-- hemisphere drives the "what's in season now" calendar. Harvest months are the
-- typical main-crop picking window (variation by altitude/year is expected).
-- Region altitudes are typical specialty bands (masl).


-- ── Countries ──────────────────────────────────────────────────────
INSERT OR REPLACE INTO ref_countries (code,name,continent,hemisphere,aliases,updated_at) VALUES
 ('ET','Ethiopia','Africa','N','["Abyssinia"]','2026-05-31'),
 ('KE','Kenya','Africa','S','[]','2026-05-31'),
 ('RW','Rwanda','Africa','S','[]','2026-05-31'),
 ('BI','Burundi','Africa','S','[]','2026-05-31'),
 ('CO','Colombia','South America','N','[]','2026-05-31'),
 ('BR','Brazil','South America','S','[]','2026-05-31'),
 ('PE','Peru','South America','S','[]','2026-05-31'),
 ('GT','Guatemala','North America','N','[]','2026-05-31'),
 ('CR','Costa Rica','North America','N','[]','2026-05-31'),
 ('HN','Honduras','North America','N','[]','2026-05-31'),
 ('SV','El Salvador','North America','N','[]','2026-05-31'),
 ('MX','Mexico','North America','N','[]','2026-05-31'),
 ('PA','Panama','North America','N','[]','2026-05-31'),
 ('ID','Indonesia','Asia','S','[]','2026-05-31'),
 ('YE','Yemen','Asia','N','["Yemen Mocha"]','2026-05-31');

-- ── Harvest windows (typical main crop) ────────────────────────────
INSERT OR REPLACE INTO ref_harvest_windows (id,country_code,label,start_month,end_month,notes) VALUES
 ('et-main','ET','main crop',10,1,'Oct–Jan picking; arrivals early/mid following year'),
 ('ke-main','KE','main crop',10,12,'Plus a smaller fly crop ~Jun–Aug'),
 ('ke-fly','KE','fly crop',6,8,NULL),
 ('rw-main','RW','main crop',3,6,NULL),
 ('bi-main','BI','main crop',4,7,NULL),
 ('co-main','CO','main crop',10,2,'Two harvests; main Oct–Feb, mitaca ~Apr–Jun'),
 ('co-mitaca','CO','mitaca (fly)',4,6,NULL),
 ('br-main','BR','main crop',5,9,NULL),
 ('pe-main','PE','main crop',6,9,NULL),
 ('gt-main','GT','main crop',12,3,NULL),
 ('cr-main','CR','main crop',12,3,NULL),
 ('hn-main','HN','main crop',11,3,NULL),
 ('sv-main','SV','main crop',11,3,NULL),
 ('mx-main','MX','main crop',11,3,NULL),
 ('pa-main','PA','main crop',12,3,NULL),
 ('id-main','ID','main crop',5,9,'Sumatra main; regional variation'),
 ('ye-main','YE','main crop',10,12,NULL);

-- ── Signature regions (specialty touchstones) ──────────────────────
INSERT OR REPLACE INTO ref_regions (id,country_code,name,altitude_min_m,altitude_max_m,lat,lng,typical_processes,aliases,updated_at) VALUES
 ('et-yirgacheffe','ET','Yirgacheffe',1700,2200,6.16,38.21,'["washed","natural"]','["Yirgachefe","Gedeo"]','2026-05-31'),
 ('et-sidamo','ET','Sidama',1500,2200,6.72,38.48,'["washed","natural"]','["Sidamo"]','2026-05-31'),
 ('et-guji','ET','Guji',1800,2300,5.95,39.10,'["washed","natural"]','[]','2026-05-31'),
 ('et-harrar','ET','Harrar',1500,2100,9.31,42.12,'["natural"]','["Harar","Harari"]','2026-05-31'),
 ('ke-nyeri','KE','Nyeri',1600,2000,-0.42,36.95,'["washed"]','[]','2026-05-31'),
 ('ke-kirinyaga','KE','Kirinyaga',1500,1900,-0.50,37.30,'["washed"]','[]','2026-05-31'),
 ('co-huila','CO','Huila',1300,1900,2.53,-75.53,'["washed"]','[]','2026-05-31'),
 ('co-narino','CO','Nariño',1700,2300,1.21,-77.28,'["washed"]','["Narino"]','2026-05-31'),
 ('co-tolima','CO','Tolima',1300,1900,4.09,-75.22,'["washed"]','[]','2026-05-31'),
 ('br-sul-de-minas','BR','Sul de Minas',900,1300,-21.55,-45.43,'["natural","pulped natural"]','[]','2026-05-31'),
 ('br-cerrado','BR','Cerrado Mineiro',800,1300,-18.80,-47.00,'["natural","pulped natural"]','[]','2026-05-31'),
 ('gt-antigua','GT','Antigua',1500,1700,14.56,-90.73,'["washed"]','[]','2026-05-31'),
 ('gt-huehuetenango','GT','Huehuetenango',1500,2000,15.32,-91.47,'["washed"]','["Huehue"]','2026-05-31'),
 ('cr-tarrazu','CR','Tarrazú',1200,1900,9.66,-84.02,'["washed","honey"]','["Tarrazu"]','2026-05-31'),
 ('pa-boquete','PA','Boquete',1200,1800,8.78,-82.44,'["washed","natural"]','[]','2026-05-31'),
 ('id-sumatra','ID','Sumatra',900,1500,3.50,98.00,'["wet-hulled"]','["Aceh","Lintong","Mandheling"]','2026-05-31'),
 ('ye-haraz','YE','Haraz',1500,2400,15.10,43.70,'["natural"]','[]','2026-05-31');

