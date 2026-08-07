-- seed :: specialty varieties NOT in the WCR catalog + other Coffea species
-- -> ref_varieties, ref_variety_lineage
--
-- These are real, specialty-relevant varieties the WCR catalog omits: modern
-- "Core Ethiopia" landrace stars selected in Colombia/Ecuador, lost-and-found
-- Scott Labs selections, low-caffeine mutations, and the non-arabica/robusta
-- Coffea species now appearing in specialty (eugenioides, liberica, excelsa,
-- stenophylla). Sourced from documented general knowledge + cited specialty
-- references; genetics flagged where the industry itself is uncertain.
-- source='general_knowledge' (NOT WCR). INSERT OR IGNORE — never clobbers.


INSERT OR IGNORE INTO ref_varieties
 (id,name,species,lineage,optimal_alt_min_m,optimal_alt_max_m,yield_potential,rust_resistance,bean_size,flavor_potential,notes,aliases,source,source_url,updated_at) VALUES

 -- ── "Core Ethiopia" landrace group selected in South America (per geneticist C. Montagnon) ──
 ('pink-bourbon','Pink Bourbon','arabica','Ethiopian landrace (Core Ethiopia group)',1500,2100,'low','susceptible','medium','Exceptional; floral, tropical, tea-like, bright','Despite the name, recent genetics place it in the Ethiopian "Core Ethiopia" landrace group, NOT Bourbon. Pink-cherried; noticed in Huila, Colombia around 2014 and now a specialty showpiece.','["Bourbon Rosado"]','general_knowledge',NULL,'2026-06-03'),
 ('chiroso','Chiroso','arabica','Ethiopian landrace (Core Ethiopia group)',1700,2100,'low','susceptible','long','Exceptional; intense florals, citrus, jasmine','Genetically identified as an Ethiopian landrace; discovered around Urrao, Antioquia, Colombia. Long, narrow bean. Long thought to be a local Caturra type.','[]','general_knowledge',NULL,'2026-06-03'),
 ('sidra','Sidra','arabica','Ethiopian landrace (Core Ethiopia group)',1500,2100,'low','susceptible','large','Exceptional; floral, stone fruit, elegant, tea-like','Grown mainly in Ecuador (Pichincha) and Colombia; genetically tied to Ethiopia. Sometimes claimed to be a Nestlé-bred Ethiopian x Bourbon hybridization — genetics still debated.','[]','general_knowledge',NULL,'2026-06-03'),
 ('ombligon','Ombligón','arabica','Ethiopian landrace (Core Ethiopia group)',1500,2000,'low','susceptible','very large','Exceptional; sweet, fruity, complex','Rare variety from Huila, Colombia. Once thought a Caturra mutation; genetic testing points to Ethiopian landrace ancestry. Distinctive "belly-button" bean.','["Ombligon"]','general_knowledge',NULL,'2026-06-03'),
 ('wush-wush-co','Wush Wush (Colombia)','arabica','Ethiopian landrace',1600,2100,'low','susceptible','variable','Exceptional; delicate florals, tea-like','Ethiopian landrace selection grown as a showpiece in Colombia; related to the Ethiopian Wush Wush. (Distinct id from the Ethiopian-origin row.)','[]','general_knowledge',NULL,'2026-06-03'),

 -- ── Scott Labs (SL) single-tree selections beyond SL14/28/34 ──
 ('sl9','SL9','arabica','Scott Labs single-tree selection (origin uncertain)',1500,2000,'low','susceptible','medium','Exceptional; complex, syrupy, deep fruit','A 1930s Scott Agricultural Laboratories selection from "a block of unknown origin" in Kenya; superb cup but very prone to Coffee Berry Disease, so largely abandoned in Kenya. Resurrected in Peru, where it is marketed as "Inca Gesha".','["Inca Gesha"]','general_knowledge',NULL,'2026-06-03'),

 -- ── Mutations / regional selections ──
 ('laurina','Laurina','arabica','Bourbon',900,1500,'low','susceptible','small','Distinctive; soft, sweet, low acidity','A naturally low-caffeine mutation of Bourbon (roughly half the caffeine). Pointed bean; originated on Réunion (Bourbon Pointu). Low yield, delicate.','["Bourbon Pointu"]','general_knowledge',NULL,'2026-06-03'),
 ('variegated-bourbon','Variegated Bourbon','arabica','Bourbon',1100,2000,'low','susceptible','medium','Very good; sweet, balanced','A striped-leaf chimeral mutation of Bourbon; ornamental and rare, occasionally micro-lotted.','["Striped Bourbon","Bourbon Variegado"]','general_knowledge',NULL,'2026-06-03'),
 ('tabi','Tabi','arabica','Hibrido de Timor-Bourbon-Typica',1400,1900,'medium','resistant','large','Very good; sweet, balanced, clean','Colombian Cenicafé variety: a (Typica x Bourbon) x Hibrido de Timor cross combining cup quality with leaf-rust resistance. "Tabi" means "good" in the Guambiano language.','[]','general_knowledge',NULL,'2026-06-03'),

 -- ── Other Coffea species now appearing in specialty ──
 ('eugenioides','Eugenioides','eugenioides','Coffea eugenioides',1600,2200,'low','susceptible','small','Distinctive; intensely sweet, low acidity, delicate','One of the two wild parents of arabica (with C. canephora). Naturally low caffeine, low yield, delicate plant; rare ultra-premium auction lots.','["Coffea eugenioides"]','general_knowledge',NULL,'2026-06-03'),
 ('liberica','Liberica','liberica','Coffea liberica',200,800,'medium','tolerant','very large','Distinctive; bold, smoky, jackfruit, woody','A separate species (~2% of world coffee), large trees thriving in hot, humid lowlands. Big beans; bold, fruity, sometimes smoky cup. Grown in the Philippines, Malaysia, Indonesia.','["Coffea liberica","Barako"]','general_knowledge',NULL,'2026-06-03'),
 ('excelsa','Excelsa','liberica','Coffea liberica var. dewevrei',1000,1300,'high','tolerant','large','Distinctive; tart, fruity, dark, complex','Once its own species, now classed as a variety of liberica. Tall, productive trees; lower caffeine; tart, fruity, layered cup.','["Coffea excelsa","Coffea liberica dewevrei"]','general_knowledge',NULL,'2026-06-03'),
 ('stenophylla','Stenophylla','stenophylla','Coffea stenophylla',300,700,'low','tolerant','medium','Notable; arabica-like — peach, blackcurrant, jasmine','A rare West African species once thought lost, rediscovered; heat-tolerant with an arabica-like cup (scored 80.25 in a 2020 London panel). A climate-resilience candidate.','["Coffea stenophylla","Highland coffee of Sierra Leone"]','general_knowledge',NULL,'2026-06-03');

-- ── Genealogy edges (parent -> child) — OR IGNORE ──
INSERT OR IGNORE INTO ref_variety_lineage (parent_id,child_id,relation) VALUES
 ('ethiopian-landrace','pink-bourbon','selection'),
 ('ethiopian-landrace','chiroso','selection'),
 ('ethiopian-landrace','sidra','selection'),
 ('ethiopian-landrace','ombligon','selection'),
 ('ethiopian-landrace','wush-wush-co','selection'),
 ('bourbon','laurina','natural mutation'),
 ('bourbon','variegated-bourbon','natural mutation'),
 ('typica','tabi','cross'),
 ('bourbon','tabi','cross'),
 ('hibrido-de-timor','tabi','cross'),
 ('liberica','excelsa','variety');
