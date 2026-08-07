-- seed :: coffee varieties + genealogy -> ref_varieties, ref_variety_lineage
-- Source: World Coffee Research Arabica Coffee Varieties catalog (varieties.org).
-- Core arabica set covering the lineages a specialty drinker actually meets.
-- Altitudes are "optimal" guidance (masl); flavor_potential is cup-quality prose.
-- NOTE: WCR data is CC BY-NC-ND — these are curated/derived reference rows, not a
-- verbatim redistribution of the catalog. Confirm commercial terms before shipping.


INSERT OR REPLACE INTO ref_varieties
 (id,name,species,lineage,optimal_alt_min_m,optimal_alt_max_m,yield_potential,rust_resistance,bean_size,flavor_potential,notes,aliases,source,source_url,updated_at) VALUES
 ('typica','Typica','arabica','Typica',1200,2000,'low','susceptible','large','Exceptional at altitude; classic clean sweetness','The genetic backbone of most Latin American arabica.','["Criollo","Sumatra"]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/typica','2026-05-31'),
 ('bourbon','Bourbon','arabica','Bourbon',1100,2000,'medium','susceptible','medium','Exceptional; sweet, complex, balanced','Natural Typica mutation from Réunion (Bourbon). Red/yellow/orange forms.','["Bourbon Rouge"]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/bourbon','2026-05-31'),
 ('yellow-bourbon','Yellow Bourbon','arabica','Bourbon',1100,2000,'medium','susceptible','medium','Sweet, soft acidity','Yellow-fruited Bourbon, likely Bourbon x Yellow Typica.','["Bourbon Amarelo"]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/yellow-bourbon','2026-05-31'),
 ('caturra','Caturra','arabica','Bourbon',900,1700,'medium','susceptible','medium','Good to very good; bright acidity','Dwarf single-gene mutation of Bourbon found in Brazil. Compact, high-yield.','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/caturra','2026-05-31'),
 ('catuai','Catuai','arabica','Bourbon',1000,1700,'high','susceptible','medium','Good; clean, mild','Mundo Novo x Caturra. Compact, weather-hardy. Red/yellow forms.','["Catuaí"]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/catuai','2026-05-31'),
 ('mundo-novo','Mundo Novo','arabica','Typica-Bourbon',1000,1700,'high','susceptible','medium','Good; heavy body, low acidity','Natural Bourbon x Typica (Sumatra) hybrid from Brazil.','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/mundo-novo','2026-05-31'),
 ('pacas','Pacas','arabica','Bourbon',1100,1700,'medium','susceptible','medium','Very good at altitude','Single-gene dwarf mutation of Bourbon found in El Salvador.','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/pacas','2026-05-31'),
 ('villa-sarchi','Villa Sarchi','arabica','Bourbon',1100,1700,'medium','susceptible','small','Very good; sweet, bright','Dwarf Bourbon mutation from Costa Rica.','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/villa-sarchi','2026-05-31'),
 ('pacamara','Pacamara','arabica','Bourbon-Maragogipe',1100,1700,'medium','susceptible','very large','Exceptional; complex, fruity, herbal','Pacas x Maragogipe cross from El Salvador. Huge beans.','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/pacamara','2026-05-31'),
 ('maragogipe','Maragogipe','arabica','Typica',1100,1800,'low','susceptible','very large','Good; soft, mild','Giant-bean Typica mutation from Brazil ("elephant bean").','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/maragogipe','2026-05-31'),
 ('gesha','Gesha','arabica','Ethiopian landrace',1500,2000,'low','susceptible','long','Exceptional; floral, jasmine, bergamot, tea-like','Panama Gesha (from Gori Gesha, Ethiopia) — the modern showpiece variety.','["Geisha"]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/gesha','2026-05-31'),
 ('sl28','SL28','arabica','Bourbon',1500,2000,'medium','susceptible','medium','Exceptional; intense blackcurrant acidity','Scott Labs selection (Kenya) from drought-tolerant Tanganyika stock.','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/sl28','2026-05-31'),
 ('sl34','SL34','arabica','Bourbon-Typica',1500,2000,'medium','susceptible','medium','Exceptional; rich, full, sweet','Scott Labs selection (Kenya); performs across altitudes.','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/sl34','2026-05-31'),
 ('ruiru-11','Ruiru 11','arabica','Catimor-SL',1300,1900,'high','resistant','small','Good; less complex than SL parents','Kenyan compact disease-resistant hybrid (1985).','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/ruiru-11','2026-05-31'),
 ('batian','Batian','arabica','Catimor-SL',1300,1900,'high','resistant','large','Very good; cleaner than Ruiru 11','Kenyan disease-resistant composite (2010), SL28/SL34 in its background.','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/batian','2026-05-31'),
 ('hibrido-de-timor','Hibrido de Timor','arabica','Arabica-Robusta',800,1500,'medium','resistant','medium','Poor cup alone; valued for rust genes','Natural arabica x robusta hybrid from Timor. Source of leaf-rust resistance.','["HdT","Tim Tim"]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/hibrido-de-timor-cifc-832-1','2026-05-31'),
 ('catimor','Catimor','arabica','Hibrido de Timor-Caturra',600,1200,'high','resistant','medium','Variable; best at altitude','Caturra x Hibrido de Timor group; rust-resistant, high-yield.','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/catimor','2026-05-31'),
 ('sarchimor','Sarchimor','arabica','Hibrido de Timor-Villa Sarchi',900,1500,'high','resistant','medium','Good at altitude; improving reputation','Villa Sarchi x Hibrido de Timor group; rust-resistant.','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/sarchimor','2026-05-31'),
 ('castillo','Castillo','arabica','Catimor',1200,1800,'high','resistant','medium','Good; modern clean cup','Colombian Catimor-derived rust-resistant variety (2005).','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/castillo','2026-05-31'),
 ('colombia','Colombia','arabica','Catimor',1200,1800,'high','resistant','medium','Good; predecessor to Castillo','Colombian Catimor-line rust-resistant variety (1980s).','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/colombia','2026-05-31'),
 ('marsellesa','Marsellesa','arabica','Sarchimor',900,1500,'high','resistant','medium','Very good; clean, sweet','Sarchimor selection popular in Mexico/Central America.','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/marsellesa','2026-05-31'),
 ('parainema','Parainema','arabica','Sarchimor',1100,1500,'high','resistant','large','Very good; can be exceptional','Honduran Sarchimor (T5296 line); cup-quality disease resistance.','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/parainema','2026-05-31'),
 ('ethiopian-landrace','Ethiopian Landrace','arabica','Ethiopian landrace',1500,2200,'low','susceptible','variable','Exceptional; floral, citrus, complex','Umbrella for the thousands of indigenous Ethiopian heirloom types ("heirloom").','["Heirloom","Ethiopian Heirloom"]','World Coffee Research','https://varieties.worldcoffeeresearch.org/','2026-05-31'),
 ('jackson','Jackson','arabica','Bourbon',1500,2000,'medium','susceptible','medium','Very good; sweet, balanced','Bourbon-derived selection grown in Rwanda/Burundi.','[]','World Coffee Research','https://varieties.worldcoffeeresearch.org/varieties/jackson-2-1257','2026-05-31'),
 ('mokka','Mokka','arabica','Typica',1200,1800,'low','susceptible','very small','Distinctive; intense, complex','Tiny-bean Typica curiosity (Mocha/Mokka). Not the port name.','["Mocha","Mokka Hybrid"]','World Coffee Research','https://varieties.worldcoffeeresearch.org/','2026-05-31');

-- ── Genealogy edges (parent -> child) — powers the family-tree explorer ──
INSERT OR REPLACE INTO ref_variety_lineage (parent_id,child_id,relation) VALUES
 ('typica','bourbon','natural mutation'),          -- Bourbon arose from Typica stock on Réunion
 ('typica','maragogipe','natural mutation'),
 ('typica','mokka','natural mutation'),
 ('bourbon','caturra','natural mutation'),
 ('bourbon','pacas','natural mutation'),
 ('bourbon','villa-sarchi','natural mutation'),
 ('bourbon','yellow-bourbon','natural mutation'),
 ('bourbon','jackson','selection'),
 ('bourbon','mundo-novo','cross'),                 -- Bourbon x Typica
 ('typica','mundo-novo','cross'),
 ('mundo-novo','catuai','cross'),                  -- Mundo Novo x Caturra
 ('caturra','catuai','cross'),
 ('pacas','pacamara','cross'),                     -- Pacas x Maragogipe
 ('maragogipe','pacamara','cross'),
 ('bourbon','sl28','selection'),
 ('bourbon','sl34','selection'),
 ('typica','sl34','selection'),
 ('hibrido-de-timor','catimor','cross'),           -- HdT x Caturra
 ('caturra','catimor','cross'),
 ('hibrido-de-timor','sarchimor','cross'),         -- HdT x Villa Sarchi
 ('villa-sarchi','sarchimor','cross'),
 ('catimor','castillo','selection'),
 ('catimor','colombia','selection'),
 ('catimor','ruiru-11','cross'),
 ('sl28','ruiru-11','cross'),
 ('catimor','batian','selection'),
 ('sl28','batian','selection'),
 ('sl34','batian','selection'),
 ('sarchimor','marsellesa','selection'),
 ('sarchimor','parainema','selection'),
 ('ethiopian-landrace','gesha','selection');       -- Gesha originates in Ethiopian forest stock

