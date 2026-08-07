-- seed :: expanded origins -> ref_countries, ref_harvest_windows, ref_regions
-- Fills out the producing world the base origins.sql omits. Altitudes are typical
-- specialty bands (masl); harvest = typical main-crop window; lat/lng given only
-- where confident (NULL otherwise — better no map pin than a wrong one).
-- hemisphere drives the "in season now" calendar. INSERT OR IGNORE throughout.


-- ── New producing countries ────────────────────────────────────────
INSERT OR IGNORE INTO ref_countries (code,name,continent,hemisphere,aliases,updated_at) VALUES
 ('TZ','Tanzania','Africa','S','[]','2026-06-03'),
 ('UG','Uganda','Africa','N','[]','2026-06-03'),
 ('CD','DR Congo','Africa','S','["Democratic Republic of the Congo","Congo"]','2026-06-03'),
 ('MW','Malawi','Africa','S','[]','2026-06-03'),
 ('ZM','Zambia','Africa','S','[]','2026-06-03'),
 ('CM','Cameroon','Africa','N','[]','2026-06-03'),
 ('EC','Ecuador','South America','S','[]','2026-06-03'),
 ('BO','Bolivia','South America','S','[]','2026-06-03'),
 ('VE','Venezuela','South America','N','[]','2026-06-03'),
 ('NI','Nicaragua','North America','N','[]','2026-06-03'),
 ('DO','Dominican Republic','North America','N','["DR"]','2026-06-03'),
 ('JM','Jamaica','North America','N','[]','2026-06-03'),
 ('IN','India','Asia','N','[]','2026-06-03'),
 ('VN','Vietnam','Asia','N','["Viet Nam"]','2026-06-03'),
 ('CN','China','Asia','N','["Yunnan"]','2026-06-03'),
 ('PG','Papua New Guinea','Oceania','S','["PNG"]','2026-06-03'),
 ('TL','Timor-Leste','Asia','S','["East Timor"]','2026-06-03');

-- ── Harvest windows (typical main crop) ────────────────────────────
INSERT OR IGNORE INTO ref_harvest_windows (id,country_code,label,start_month,end_month,notes) VALUES
 ('tz-main','TZ','main crop',7,12,'Northern (Kilimanjaro/Arusha) and Southern (Mbeya) highlands'),
 ('ug-main','UG','main crop',10,2,'Plus a secondary crop ~Apr–Jun; arabica on Mt Elgon'),
 ('cd-main','CD','main crop',3,6,'Kivu region around Lake Kivu; also a smaller Oct crop'),
 ('mw-main','MW','main crop',6,10,NULL),
 ('zm-main','ZM','main crop',6,9,NULL),
 ('cm-main','CM','main crop',10,1,NULL),
 ('ec-main','EC','main crop',5,9,'Wide variation by altitude/region'),
 ('bo-main','BO','main crop',7,11,NULL),
 ('ve-main','VE','main crop',10,2,NULL),
 ('ni-main','NI','main crop',11,3,NULL),
 ('do-main','DO','main crop',11,3,'Long season into spring'),
 ('jm-main','JM','main crop',9,2,'Blue Mountain; long picking into winter'),
 ('in-main','IN','main crop',11,2,'Arabica Nov–Feb; robusta Jan–Mar'),
 ('vn-main','VN','main crop',10,1,'Robusta-dominant; arabica in Da Lat/Son La'),
 ('cn-main','CN','main crop',11,2,'Yunnan'),
 ('pg-main','PG','main crop',4,9,NULL),
 ('tl-main','TL','main crop',5,9,NULL);

-- ── Regions: fill out already-seeded origins ───────────────────────
INSERT OR IGNORE INTO ref_regions (id,country_code,name,altitude_min_m,altitude_max_m,lat,lng,typical_processes,aliases,updated_at) VALUES
 -- Ethiopia
 ('et-limu','ET','Limu',1400,2000,8.10,36.80,'["washed","natural"]','["Limmu"]','2026-06-03'),
 ('et-jimma','ET','Jimma',1400,2000,7.67,36.83,'["natural","washed"]','["Djimmah","Agaro"]','2026-06-03'),
 ('et-kaffa','ET','Kaffa',1500,2100,7.27,36.23,'["washed","natural"]','["Keffa","Bonga"]','2026-06-03'),
 ('et-gedeo','ET','Gedeo',1800,2200,6.10,38.30,'["washed","natural"]','["Gedeb"]','2026-06-03'),
 ('et-wollega','ET','Wollega',1500,2100,9.10,36.50,'["natural","washed"]','["Wellega","Gimbi","Nekemte"]','2026-06-03'),
 ('et-bench-maji','ET','Bench Maji',1500,2000,6.20,35.50,'["natural","washed"]','["Bench Sheko"]','2026-06-03'),
 -- Kenya
 ('ke-muranga','KE','Murang''a',1500,1900,-0.78,37.13,'["washed"]','["Muranga"]','2026-06-03'),
 ('ke-embu','KE','Embu',1300,1800,-0.53,37.45,'["washed"]','[]','2026-06-03'),
 ('ke-meru','KE','Meru',1300,1900,0.05,37.65,'["washed"]','[]','2026-06-03'),
 ('ke-kiambu','KE','Kiambu',1500,1900,-1.17,36.83,'["washed"]','[]','2026-06-03'),
 -- Colombia
 ('co-cauca','CO','Cauca',1500,2100,2.44,-76.61,'["washed"]','[]','2026-06-03'),
 ('co-antioquia','CO','Antioquia',1500,2100,6.25,-75.57,'["washed"]','["Urrao"]','2026-06-03'),
 ('co-santander','CO','Santander',1200,1800,6.64,-73.13,'["washed"]','[]','2026-06-03'),
 ('co-sierra-nevada','CO','Sierra Nevada de Santa Marta',900,1700,10.83,-73.68,'["washed"]','["Magdalena"]','2026-06-03'),
 ('co-quindio','CO','Quindío',1300,2000,4.46,-75.67,'["washed"]','["Eje Cafetero"]','2026-06-03'),
 ('co-caldas','CO','Caldas',1300,2000,5.07,-75.52,'["washed"]','["Eje Cafetero"]','2026-06-03'),
 ('co-risaralda','CO','Risaralda',1300,2000,5.31,-75.99,'["washed"]','["Eje Cafetero"]','2026-06-03'),
 -- Brazil
 ('br-mogiana','BR','Mogiana',900,1300,-20.90,-47.30,'["natural","pulped-natural"]','[]','2026-06-03'),
 ('br-mantiqueira','BR','Mantiqueira de Minas',1000,1500,-22.20,-45.10,'["natural","pulped-natural"]','["Serra da Mantiqueira"]','2026-06-03'),
 ('br-chapada-diamantina','BR','Chapada Diamantina',1000,1400,-12.60,-41.40,'["natural","washed"]','["Bahia"]','2026-06-03'),
 ('br-espirito-santo','BR','Espírito Santo',700,1200,-19.50,-40.60,'["natural","pulped-natural"]','["Espirito Santo"]','2026-06-03'),
 -- Guatemala
 ('gt-atitlan','GT','Atitlán',1500,1900,14.70,-91.20,'["washed"]','["Atitlan"]','2026-06-03'),
 ('gt-coban','GT','Cobán',1300,1500,15.47,-90.37,'["washed"]','["Coban"]','2026-06-03'),
 ('gt-acatenango','GT','Acatenango',1300,2000,14.55,-90.94,'["washed"]','[]','2026-06-03'),
 ('gt-san-marcos','GT','San Marcos',1300,1800,14.96,-91.80,'["washed","natural"]','[]','2026-06-03'),
 ('gt-nuevo-oriente','GT','Nuevo Oriente',1300,1700,14.55,-89.40,'["washed"]','[]','2026-06-03'),
 -- Costa Rica
 ('cr-west-valley','CR','West Valley',1200,1700,10.10,-84.40,'["washed","honey"]','["Valle Occidental"]','2026-06-03'),
 ('cr-central-valley','CR','Central Valley',1000,1600,9.95,-84.05,'["washed","honey"]','["Valle Central"]','2026-06-03'),
 ('cr-tres-rios','CR','Tres Ríos',1200,1650,9.90,-83.97,'["washed"]','["Tres Rios"]','2026-06-03'),
 ('cr-brunca','CR','Brunca',800,1700,8.80,-83.00,'["washed","honey"]','[]','2026-06-03'),
 -- Panama
 ('pa-volcan','PA','Volcán-Candela',1200,1900,8.77,-82.63,'["washed","natural","honey"]','["Volcan","Renacimiento"]','2026-06-03'),
 -- Mexico
 ('mx-chiapas','MX','Chiapas',900,1700,15.50,-92.30,'["washed"]','[]','2026-06-03'),
 ('mx-oaxaca','MX','Oaxaca',900,1650,16.50,-96.50,'["washed","natural"]','["Pluma Hidalgo"]','2026-06-03'),
 ('mx-veracruz','MX','Veracruz',800,1400,19.20,-96.90,'["washed"]','[]','2026-06-03'),
 -- Peru
 ('pe-cajamarca','PE','Cajamarca',1500,2000,-6.50,-78.50,'["washed"]','["Jaen","San Ignacio"]','2026-06-03'),
 ('pe-amazonas','PE','Amazonas',1400,2000,-5.70,-78.00,'["washed"]','["Rodriguez de Mendoza"]','2026-06-03'),
 ('pe-san-martin','PE','San Martín',1100,1800,-6.50,-76.80,'["washed"]','["San Martin"]','2026-06-03'),
 ('pe-puno','PE','Puno',1400,2000,-13.50,-69.50,'["washed"]','["Sandia"]','2026-06-03'),
 -- Honduras
 ('hn-copan','HN','Copán',1000,1500,14.85,-88.90,'["washed"]','["Copan"]','2026-06-03'),
 ('hn-montecillos','HN','Montecillos',1200,1700,14.13,-88.00,'["washed"]','["Marcala"]','2026-06-03'),
 ('hn-comayagua','HN','Comayagua',1100,1600,14.45,-87.65,'["washed"]','[]','2026-06-03'),
 ('hn-el-paraiso','HN','El Paraíso',1000,1600,13.95,-86.60,'["washed"]','["El Paraiso"]','2026-06-03'),
 -- El Salvador
 ('sv-apaneca','SV','Apaneca-Ilamatepec',1000,1900,13.85,-89.80,'["washed","honey","natural"]','["Apaneca","Ruta de las Flores"]','2026-06-03'),
 -- Yemen
 ('ye-bani-matar','YE','Bani Matar',1800,2400,15.20,44.00,'["natural"]','["Bani Mattar"]','2026-06-03'),
 -- Tanzania
 ('tz-kilimanjaro','TZ','Kilimanjaro',1400,2000,-3.30,37.30,'["washed"]','["Moshi"]','2026-06-03'),
 ('tz-mbeya','TZ','Mbeya',1400,2000,-8.90,33.45,'["washed"]','["Southern Highlands"]','2026-06-03'),
 ('tz-arusha','TZ','Arusha',1300,1900,-3.37,36.69,'["washed"]','["Mt Meru"]','2026-06-03'),
 -- Uganda
 ('ug-mt-elgon','UG','Mount Elgon',1500,2300,1.10,34.50,'["washed","natural"]','["Sipi","Bugisu","Bukonzo"]','2026-06-03'),
 ('ug-rwenzori','UG','Rwenzori',1200,2000,0.38,30.00,'["washed","natural"]','[]','2026-06-03'),
 -- DR Congo
 ('cd-kivu','CD','Kivu',1400,2000,-2.00,29.00,'["washed"]','["South Kivu","North Kivu","Lake Kivu"]','2026-06-03'),
 -- Malawi
 ('mw-misuku','MW','Misuku Hills',1500,2000,-9.65,33.55,'["washed"]','[]','2026-06-03'),
 -- Ecuador
 ('ec-pichincha','EC','Pichincha',1400,2000,-0.10,-78.60,'["washed","natural","honey"]','[]','2026-06-03'),
 ('ec-loja','EC','Loja',1400,2100,-4.00,-79.20,'["washed","natural"]','[]','2026-06-03'),
 -- Bolivia
 ('bo-caranavi','BO','Caranavi',1300,1700,-15.83,-67.57,'["washed"]','[]','2026-06-03'),
 -- Nicaragua
 ('ni-jinotega','NI','Jinotega',1100,1700,13.09,-86.00,'["washed","honey"]','[]','2026-06-03'),
 ('ni-matagalpa','NI','Matagalpa',1000,1500,12.93,-85.92,'["washed","honey"]','[]','2026-06-03'),
 ('ni-nueva-segovia','NI','Nueva Segovia',1100,1700,13.76,-86.53,'["washed"]','[]','2026-06-03'),
 -- India
 ('in-chikmagalur','IN','Chikmagalur',1000,1500,13.32,75.77,'["washed","natural","monsooned"]','["Baba Budangiri","Karnataka"]','2026-06-03'),
 ('in-coorg','IN','Coorg',900,1500,12.42,75.74,'["washed","natural"]','["Kodagu"]','2026-06-03'),
 ('in-malabar','IN','Malabar',0,800,11.50,75.80,'["monsooned"]','["Monsooned Malabar"]','2026-06-03'),
 -- Vietnam
 ('vn-da-lat','VN','Da Lat',1300,1700,11.94,108.44,'["washed","natural"]','["Lam Dong","Cau Dat"]','2026-06-03'),
 ('vn-son-la','VN','Son La',1100,1500,21.33,103.92,'["washed","honey"]','[]','2026-06-03'),
 -- China
 ('cn-yunnan','CN','Yunnan',1000,1800,24.50,100.50,'["washed","natural"]','["Pu''er","Baoshan"]','2026-06-03'),
 -- Papua New Guinea
 ('pg-eastern-highlands','PG','Eastern Highlands',1300,1900,-6.10,145.40,'["washed"]','["Sigri","Wahgi Valley"]','2026-06-03'),
 -- Timor-Leste
 ('tl-ermera','TL','Ermera',1200,1800,-8.75,125.40,'["washed","natural"]','[]','2026-06-03'),
 -- Jamaica
 ('jm-blue-mountain','JM','Blue Mountains',900,1700,18.05,-76.58,'["washed"]','["Blue Mountain"]','2026-06-03'),
 -- Dominican Republic
 ('do-barahona','DO','Barahona',600,1300,18.21,-71.10,'["washed"]','[]','2026-06-03');
