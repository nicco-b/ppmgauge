-- seed :: WCR variety catalog expansion -> ref_varieties, ref_variety_lineage
-- Source: World Coffee Research Arabica Coffee Varieties catalog
-- (varieties.worldcoffeeresearch.org), plus widely-documented Ethiopian JARC /
-- local-landrace selections that appear on specialty bags.
--
-- These are curated/derived FACT rows (species, lineage, optimal altitude, rust
-- resistance, yield, bean size) with original cup-potential prose — NOT a verbatim
-- redistribution of the catalog. Every row carries source + source_url. WCR data is
-- CC BY-NC-ND; attribution is preserved on every row.
--
-- INSERT OR IGNORE: this only ADDS new varieties, never clobbers the 27 already
-- curated. Load order: varieties.sql first (parents), then this file.
-- Convention match: yield_potential low|medium|high, rust_resistance
-- susceptible|tolerant|resistant, bean_size small|medium|large|very large|long|variable.


INSERT OR IGNORE INTO ref_varieties
 (id,name,species,lineage,optimal_alt_min_m,optimal_alt_max_m,yield_potential,rust_resistance,bean_size,flavor_potential,notes,aliases,source,source_url,updated_at) VALUES

 -- ── Sarchimor / Catimor disease-resistant lines (Hibrido de Timor descent) ──
 ('anacafe-14','Anacafé 14','arabica','Catimor-Pacamara',1300,1700,'high','resistant','large','Good to very good; clean with body','Guatemalan spontaneous Catimor x Pacamara cross; drought-tolerant and rust-resistant, released by Anacafé.','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/anacafe-14','2026-06-03'),
 ('catigua-mg2','Catiguá MG2','arabica','Catuai-Hibrido de Timor',1000,1500,'high','resistant','medium','Good; sweet, balanced','Brazilian Catuaí x Hibrido de Timor (UFV 440-22) selection from EPAMIG; rust-resistant and compact.','["Catigua MG2"]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/catigua-mg2','2026-06-03'),
 ('costa-rica-95','Costa Rica 95','arabica','Sarchimor',900,1400,'high','tolerant','large','Good at altitude; clean','Sarchimor line (Caturra x Hibrido de Timor, T5296) released in Costa Rica; rust resistance has weakened over time.','["CR-95"]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/costa-rica-95','2026-06-03'),
 ('cenicafe-1','Cenicafé 1','arabica','Catimor',1300,1800,'high','resistant','medium','Good; modern clean cup','Colombian Caturra x Hibrido de Timor line from Cenicafé; a more genetically uniform sibling of Castillo.','["Cenicafe 1"]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/cenicafe-1','2026-06-03'),
 ('iapar-59','IAPAR 59','arabica','Sarchimor',900,1400,'high','resistant','medium','Good; clean, mild','Brazilian Sarchimor (Villa Sarchi x Hibrido de Timor) from IAPAR; compact, dense planting, rust-resistant.','["IAPAR59"]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/iapar-59','2026-06-03'),
 ('obata','Obatã','arabica','Sarchimor',1000,1500,'high','tolerant','medium','Good; clean, soft','Brazilian Sarchimor (Obatã IAC 1669-20, Villa Sarchi x Hibrido de Timor); rust resistance breaking down in places.','["Obata","Obata IAC 1669-20"]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/obata-vermelho','2026-06-03'),
 ('limani','Limani','arabica','Catimor',900,1400,'high','resistant','medium','Good; mild','Catimor-type rust-resistant variety released in Puerto Rico.','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/limani','2026-06-03'),
 ('t5296','T5296','arabica','Sarchimor',900,1500,'high','resistant','medium','Variable; breeding baseline','Foundational Sarchimor breeding line (Villa Sarchi x Hibrido de Timor 832/2); parent of Parainema, Obatã, Costa Rica 95 and Centroamericano.','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/t5296','2026-06-03'),

 -- ── Brazilian interspecific / Mundo Novo descent ──
 ('icatu','Icatu','arabica','Mundo Novo-Robusta',900,1400,'high','resistant','large','Good; full body, mild acidity','Brazilian interspecific selection — robusta crossed into Bourbon then backcrossed to Mundo Novo and Caturra; tall, vigorous, rust-resistant. Red/Yellow/Precoce forms.','["Icatu Vermelho","Icatu Amarelo"]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/icatu','2026-06-03'),
 ('topazio','Topázio','arabica','Mundo Novo-Caturra',1000,1600,'high','susceptible','medium','Good; sweet, soft','Brazilian Mundo Novo x Caturra (yellow-fruited, MG1190), a sibling line to Catuaí.','["Topazio","Topazio MG1190"]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/topazio-mg-1190','2026-06-03'),

 -- ── Bourbon / Typica selections ──
 ('tekisic','Tekisic','arabica','Bourbon',1200,1800,'medium','susceptible','medium','Exceptional; sweet, complex, bright','Improved Bourbon mass-selection from El Salvador (ISIC); a benchmark Central American Bourbon.','["Tekisik"]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/tekisic','2026-06-03'),
 ('pache','Pache','arabica','Typica',1000,1700,'medium','susceptible','medium','Good; soft, smooth','Guatemalan compact Typica mutation (Pache Comum); the Pache Colís form is a Pache x Caturra.','["Pache Comum","Pache Colis"]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/pache-comum','2026-06-03'),
 ('mibirizi','Mibirizi','arabica','Bourbon',1400,1900,'medium','susceptible','medium','Very good; sweet, juicy','Bourbon selection originating in Rwanda (Mibirizi) in the 1930s; widespread across Rwanda and Burundi.','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/mibirizi','2026-06-03'),
 ('k7','K7','arabica','Bourbon',1400,1900,'medium','tolerant','medium','Very good; soft, sweet','Kenyan French Mission Bourbon selection (from Legelet); some field tolerance to leaf rust and CBD.','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/k7','2026-06-03'),
 ('sl14','SL14','arabica','Bourbon',1400,1900,'medium','susceptible','medium','Good; sweet','Drought-tolerant Bourbon-type Scott Labs selection from Kenya; planted where water is scarce.','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/sl14','2026-06-03'),
 ('java','Java','arabica','Ethiopian landrace',1000,1800,'medium','tolerant','long','Very good; clean, floral, citrus','Ethiopian-origin (Abyssinia) selection distributed via Indonesia and Cameroon; tall, long-beaned, with some CBD tolerance.','["Abyssinia","Long Berry"]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/java','2026-06-03'),

 -- ── F1 hybrids (vigor + cup quality, seed- or clonally-propagated) ──
 ('centroamericano','Centroamericano','arabica','F1 hybrid',1100,1700,'high','resistant','large','Exceptional; complex, floral, sweet','F1 hybrid (Rume Sudan x T5296 Sarchimor) from CIRAD/PROMECAFE; hybrid vigor with high-end cup quality. Also called H1.','["H1"]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/h1-centroamericano','2026-06-03'),
 ('milenio','Milenio','arabica','F1 hybrid',1100,1700,'high','resistant','large','Very good to exceptional; sweet, clean','F1 hybrid (Sarchimor x wild Ethiopian) from ECOM/CIRAD; vigorous and rust-resistant. Also called H10.','["H10"]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/milenio','2026-06-03'),
 ('starmaya','Starmaya','arabica','F1 hybrid',1100,1700,'high','resistant','large','Very good to exceptional; floral, bright','First seed-propagated F1 hybrid (Marsellesa x a male-sterile wild Ethiopian) from ECOM/CIRAD; rust-resistant.','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/starmaya','2026-06-03'),

 -- ── Wild Ethiopian accessions & landrace selections (key parents / bag names) ──
 ('sudan-rume','Sudan Rume','arabica','Ethiopian landrace',1500,2000,'low','susceptible','small','Exceptional; intense, syrupy, complex','Wild accession from the Boma Plateau (South Sudan/Ethiopia border); low-yielding but a prized cup-quality parent in modern F1 hybrids.','["Rume Sudan"]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/rume-sudan','2026-06-03'),
 ('wush-wush','Wush Wush','arabica','Ethiopian landrace',1500,2100,'low','susceptible','variable','Exceptional; floral, tea-like, delicate','Ethiopian landrace selection (named for the Wush Wush area) now famous as a showpiece planting in Colombia.','["Wush-Wush"]','general_knowledge',NULL,'2026-06-03'),
 ('74110','74110','arabica','Ethiopian landrace',1500,2100,'medium','tolerant','medium','Very good; floral, citric','JARC (Jimma) disease-resistant landrace selection from the Metu-Bishari forest, released 1979; CBD-resistant. Common on Ethiopian bags.','["74-110"]','general_knowledge',NULL,'2026-06-03'),
 ('74112','74112','arabica','Ethiopian landrace',1500,2100,'medium','tolerant','medium','Very good; floral, stone fruit','JARC (Jimma) disease-resistant landrace selection from the Metu-Bishari forest, released 1979; CBD-resistant. Common on Ethiopian bags.','["74-112"]','general_knowledge',NULL,'2026-06-03'),
 ('74158','74158','arabica','Ethiopian landrace',1500,2100,'medium','tolerant','medium','Very good; floral, bright','JARC (Jimma) disease-resistant landrace selection, CBD-resistant and widely distributed across Ethiopia. Very common on specialty bags.','["74-158"]','general_knowledge',NULL,'2026-06-03'),
 ('kurume','Kurume','arabica','Ethiopian landrace',1700,2200,'low','susceptible','small','Exceptional; floral, citrus, tea-like','Local Ethiopian landrace type (small, round bean) common in Yirgacheffe/Sidama gardens.','[]','general_knowledge',NULL,'2026-06-03'),
 ('wolisho','Wolisho','arabica','Ethiopian landrace',1700,2200,'low','susceptible','large','Exceptional; sweet, floral, full','Local Ethiopian landrace type (tall, larger bean) common in Yirgacheffe/Sidama gardens, often grown alongside Kurume.','[]','general_knowledge',NULL,'2026-06-03'),
 ('dega','Dega','arabica','Ethiopian landrace',1700,2200,'low','susceptible','medium','Exceptional; floral, delicate','Local Ethiopian landrace type from the Gedeo/Sidama highlands.','[]','general_knowledge',NULL,'2026-06-03');

-- ── Genealogy edges (parent -> child) — powers the family-tree explorer ──
-- OR IGNORE so re-runs and overlap with varieties.sql edges are harmless.
INSERT OR IGNORE INTO ref_variety_lineage (parent_id,child_id,relation) VALUES
 -- Sarchimor / Catimor descent
 ('catimor','anacafe-14','cross'),
 ('pacamara','anacafe-14','cross'),
 ('catuai','catigua-mg2','cross'),
 ('hibrido-de-timor','catigua-mg2','cross'),
 ('villa-sarchi','t5296','cross'),
 ('hibrido-de-timor','t5296','cross'),
 ('t5296','costa-rica-95','selection'),
 ('caturra','cenicafe-1','cross'),
 ('hibrido-de-timor','cenicafe-1','cross'),
 ('castillo','cenicafe-1','selection'),
 ('villa-sarchi','iapar-59','cross'),
 ('hibrido-de-timor','iapar-59','cross'),
 ('sarchimor','iapar-59','selection'),
 ('villa-sarchi','obata','cross'),
 ('hibrido-de-timor','obata','cross'),
 ('sarchimor','obata','selection'),
 ('catimor','limani','selection'),
 -- Brazilian interspecific / Mundo Novo
 ('mundo-novo','icatu','cross'),
 ('caturra','icatu','cross'),
 ('mundo-novo','topazio','cross'),
 ('caturra','topazio','cross'),
 -- Bourbon / Typica selections
 ('bourbon','tekisic','selection'),
 ('typica','pache','natural mutation'),
 ('bourbon','mibirizi','selection'),
 ('bourbon','k7','selection'),
 ('bourbon','sl14','selection'),
 ('ethiopian-landrace','java','selection'),
 -- F1 hybrids
 ('sarchimor','centroamericano','cross'),
 ('sudan-rume','centroamericano','cross'),
 ('sarchimor','milenio','cross'),
 ('marsellesa','starmaya','cross'),
 ('sudan-rume','starmaya','cross'),
 -- Wild Ethiopian accessions & landrace selections
 ('ethiopian-landrace','sudan-rume','selection'),
 ('ethiopian-landrace','wush-wush','selection'),
 ('ethiopian-landrace','74110','selection'),
 ('ethiopian-landrace','74112','selection'),
 ('ethiopian-landrace','74158','selection'),
 ('ethiopian-landrace','kurume','selection'),
 ('ethiopian-landrace','wolisho','selection'),
 ('ethiopian-landrace','dega','selection');
