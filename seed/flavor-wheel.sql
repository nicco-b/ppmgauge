-- seed :: SCA / WCR Coffee Taster's Flavor Wheel (2016) -> ref_flavors
-- Hierarchy: tier 1 (inner ring, 9 categories) -> tier 2 -> tier 3 (outer).
-- parent_id is NULL only at tier 1. color = family hex for the wheel UI.
-- This is THE linchpin: published notes (ref_coffee_flavors) AND user cupping
-- notes (user_cupping_flavors) both reference these ids -> palate calibration.
-- Source: SCA/WCR Coffee Taster's Flavor Wheel, derived from the Sensory Lexicon.


-- ── Tier 1 — the 9 categories ──────────────────────────────────────
INSERT OR REPLACE INTO ref_flavors (id,name,parent_id,tier,color,lexicon_ref) VALUES
 ('floral',          'Floral',          NULL, 1, '#C9518B', NULL),
 ('fruity',          'Fruity',          NULL, 1, '#E0322E', NULL),
 ('sour-fermented',  'Sour / Fermented',NULL, 1, '#E8B71A', NULL),
 ('green-vegetative','Green / Vegetative',NULL,1,'#4A8B3A', NULL),
 ('other',           'Other',           NULL, 1, '#7FB5C4', NULL),
 ('roasted',         'Roasted',         NULL, 1, '#B0533A', NULL),
 ('spices',          'Spices',          NULL, 1, '#9B2D30', NULL),
 ('nutty-cocoa',     'Nutty / Cocoa',   NULL, 1, '#8B5A2B', NULL),
 ('sweet',           'Sweet',           NULL, 1, '#E0922F', NULL);

-- ── Floral ─────────────────────────────────────────────────────────
INSERT OR REPLACE INTO ref_flavors (id,name,parent_id,tier,color,lexicon_ref) VALUES
 ('floral-black-tea','Black Tea','floral',2,'#C9518B',NULL),
 ('floral-floral',   'Floral',  'floral',2,'#C9518B',NULL),
 ('floral-chamomile','Chamomile','floral-floral',3,'#C9518B',NULL),
 ('floral-rose',     'Rose',    'floral-floral',3,'#C9518B',NULL),
 ('floral-jasmine',  'Jasmine', 'floral-floral',3,'#C9518B',NULL);

-- ── Fruity ─────────────────────────────────────────────────────────
INSERT OR REPLACE INTO ref_flavors (id,name,parent_id,tier,color,lexicon_ref) VALUES
 ('fruity-berry',      'Berry',      'fruity',2,'#E0322E',NULL),
 ('fruity-blackberry', 'Blackberry', 'fruity-berry',3,'#E0322E',NULL),
 ('fruity-raspberry',  'Raspberry',  'fruity-berry',3,'#E0322E',NULL),
 ('fruity-blueberry',  'Blueberry',  'fruity-berry',3,'#E0322E',NULL),
 ('fruity-strawberry', 'Strawberry', 'fruity-berry',3,'#E0322E',NULL),
 ('fruity-dried',      'Dried Fruit','fruity',2,'#E0322E',NULL),
 ('fruity-raisin',     'Raisin',     'fruity-dried',3,'#E0322E',NULL),
 ('fruity-prune',      'Prune',      'fruity-dried',3,'#E0322E',NULL),
 ('fruity-other',      'Other Fruit','fruity',2,'#E0322E',NULL),
 ('fruity-coconut',    'Coconut',    'fruity-other',3,'#E0322E',NULL),
 ('fruity-cherry',     'Cherry',     'fruity-other',3,'#E0322E',NULL),
 ('fruity-pomegranate','Pomegranate','fruity-other',3,'#E0322E',NULL),
 ('fruity-pineapple',  'Pineapple',  'fruity-other',3,'#E0322E',NULL),
 ('fruity-grape',      'Grape',      'fruity-other',3,'#E0322E',NULL),
 ('fruity-apple',      'Apple',      'fruity-other',3,'#E0322E',NULL),
 ('fruity-peach',      'Peach',      'fruity-other',3,'#E0322E',NULL),
 ('fruity-pear',       'Pear',       'fruity-other',3,'#E0322E',NULL),
 ('fruity-citrus',     'Citrus Fruit','fruity',2,'#E0322E',NULL),
 ('fruity-grapefruit', 'Grapefruit', 'fruity-citrus',3,'#E0322E',NULL),
 ('fruity-orange',     'Orange',     'fruity-citrus',3,'#E0322E',NULL),
 ('fruity-lemon',      'Lemon',      'fruity-citrus',3,'#E0322E',NULL),
 ('fruity-lime',       'Lime',       'fruity-citrus',3,'#E0322E',NULL);

-- ── Sour / Fermented ───────────────────────────────────────────────
INSERT OR REPLACE INTO ref_flavors (id,name,parent_id,tier,color,lexicon_ref) VALUES
 ('sf-sour',          'Sour',           'sour-fermented',2,'#E8B71A',NULL),
 ('sf-sour-aromatics','Sour Aromatics', 'sf-sour',3,'#E8B71A',NULL),
 ('sf-acetic',        'Acetic Acid',    'sf-sour',3,'#E8B71A',NULL),
 ('sf-citric',        'Citric Acid',    'sf-sour',3,'#E8B71A',NULL),
 ('sf-malic',         'Malic Acid',     'sf-sour',3,'#E8B71A',NULL),
 ('sf-fermented',     'Alcohol / Fermented','sour-fermented',2,'#E8B71A',NULL),
 ('sf-winey',         'Winey',          'sf-fermented',3,'#E8B71A',NULL),
 ('sf-whiskey',       'Whiskey',        'sf-fermented',3,'#E8B71A',NULL),
 ('sf-ferment',       'Fermented',      'sf-fermented',3,'#E8B71A',NULL),
 ('sf-overripe',      'Overripe',       'sf-fermented',3,'#E8B71A',NULL);

-- ── Green / Vegetative ─────────────────────────────────────────────
INSERT OR REPLACE INTO ref_flavors (id,name,parent_id,tier,color,lexicon_ref) VALUES
 ('gv-olive-oil',  'Olive Oil',         'green-vegetative',2,'#4A8B3A',NULL),
 ('gv-raw',        'Raw',               'green-vegetative',2,'#4A8B3A',NULL),
 ('gv-green',      'Green / Vegetative','green-vegetative',2,'#4A8B3A',NULL),
 ('gv-underripe',  'Under-ripe',        'gv-green',3,'#4A8B3A',NULL),
 ('gv-peapod',     'Peapod',            'gv-green',3,'#4A8B3A',NULL),
 ('gv-fresh',      'Fresh',             'gv-green',3,'#4A8B3A',NULL),
 ('gv-dark-green', 'Dark Green',        'gv-green',3,'#4A8B3A',NULL),
 ('gv-vegetative', 'Vegetative',        'gv-green',3,'#4A8B3A',NULL),
 ('gv-hay',        'Hay-like',          'gv-green',3,'#4A8B3A',NULL),
 ('gv-herb',       'Herb-like',         'gv-green',3,'#4A8B3A',NULL),
 ('gv-beany',      'Beany',             'green-vegetative',2,'#4A8B3A',NULL);

-- ── Other ──────────────────────────────────────────────────────────
INSERT OR REPLACE INTO ref_flavors (id,name,parent_id,tier,color,lexicon_ref) VALUES
 ('other-papery-musty','Papery / Musty','other',2,'#7FB5C4',NULL),
 ('other-stale',     'Stale',      'other-papery-musty',3,'#7FB5C4',NULL),
 ('other-cardboard', 'Cardboard',  'other-papery-musty',3,'#7FB5C4',NULL),
 ('other-papery',    'Papery',     'other-papery-musty',3,'#7FB5C4',NULL),
 ('other-woody',     'Woody',      'other-papery-musty',3,'#7FB5C4',NULL),
 ('other-moldy-damp','Moldy / Damp','other-papery-musty',3,'#7FB5C4',NULL),
 ('other-musty-dusty','Musty / Dusty','other-papery-musty',3,'#7FB5C4',NULL),
 ('other-musty-earthy','Musty / Earthy','other-papery-musty',3,'#7FB5C4',NULL),
 ('other-animalic',  'Animalic',   'other-papery-musty',3,'#7FB5C4',NULL),
 ('other-meaty',     'Meaty Brothy','other-papery-musty',3,'#7FB5C4',NULL),
 ('other-phenolic',  'Phenolic',   'other-papery-musty',3,'#7FB5C4',NULL),
 ('other-chemical',  'Chemical',   'other',2,'#7FB5C4',NULL),
 ('other-bitter',    'Bitter',     'other-chemical',3,'#7FB5C4',NULL),
 ('other-salty',     'Salty',      'other-chemical',3,'#7FB5C4',NULL),
 ('other-medicinal', 'Medicinal',  'other-chemical',3,'#7FB5C4',NULL),
 ('other-petroleum', 'Petroleum',  'other-chemical',3,'#7FB5C4',NULL),
 ('other-skunky',    'Skunky',     'other-chemical',3,'#7FB5C4',NULL),
 ('other-rubber',    'Rubber',     'other-chemical',3,'#7FB5C4',NULL);

-- ── Roasted ────────────────────────────────────────────────────────
INSERT OR REPLACE INTO ref_flavors (id,name,parent_id,tier,color,lexicon_ref) VALUES
 ('roasted-pipe-tobacco','Pipe Tobacco','roasted',2,'#B0533A',NULL),
 ('roasted-tobacco',  'Tobacco',     'roasted',2,'#B0533A',NULL),
 ('roasted-burnt',    'Burnt',       'roasted',2,'#B0533A',NULL),
 ('roasted-acrid',    'Acrid',       'roasted-burnt',3,'#B0533A',NULL),
 ('roasted-ashy',     'Ashy',        'roasted-burnt',3,'#B0533A',NULL),
 ('roasted-smoky',    'Smoky',       'roasted-burnt',3,'#B0533A',NULL),
 ('roasted-brown',    'Brown Roast',  'roasted-burnt',3,'#B0533A',NULL),
 ('roasted-cereal',   'Cereal',      'roasted',2,'#B0533A',NULL),
 ('roasted-grain',    'Grain',       'roasted-cereal',3,'#B0533A',NULL),
 ('roasted-malt',     'Malt',        'roasted-cereal',3,'#B0533A',NULL);

-- ── Spices ─────────────────────────────────────────────────────────
INSERT OR REPLACE INTO ref_flavors (id,name,parent_id,tier,color,lexicon_ref) VALUES
 ('spices-pungent',     'Pungent',    'spices',2,'#9B2D30',NULL),
 ('spices-pepper',      'Pepper',     'spices',2,'#9B2D30',NULL),
 ('spices-brown-spice', 'Brown Spice','spices',2,'#9B2D30',NULL),
 ('spices-anise',       'Anise',      'spices-brown-spice',3,'#9B2D30',NULL),
 ('spices-nutmeg',      'Nutmeg',     'spices-brown-spice',3,'#9B2D30',NULL),
 ('spices-cinnamon',    'Cinnamon',   'spices-brown-spice',3,'#9B2D30',NULL),
 ('spices-clove',       'Clove',      'spices-brown-spice',3,'#9B2D30',NULL);

-- ── Nutty / Cocoa ──────────────────────────────────────────────────
INSERT OR REPLACE INTO ref_flavors (id,name,parent_id,tier,color,lexicon_ref) VALUES
 ('nc-nutty',          'Nutty',         'nutty-cocoa',2,'#8B5A2B',NULL),
 ('nc-peanuts',        'Peanuts',       'nc-nutty',3,'#8B5A2B',NULL),
 ('nc-hazelnut',       'Hazelnut',      'nc-nutty',3,'#8B5A2B',NULL),
 ('nc-almond',         'Almond',        'nc-nutty',3,'#8B5A2B',NULL),
 ('nc-cocoa',          'Cocoa',         'nutty-cocoa',2,'#8B5A2B',NULL),
 ('nc-chocolate',      'Chocolate',     'nc-cocoa',3,'#8B5A2B',NULL),
 ('nc-dark-chocolate', 'Dark Chocolate','nc-cocoa',3,'#8B5A2B',NULL);

-- ── Sweet ──────────────────────────────────────────────────────────
INSERT OR REPLACE INTO ref_flavors (id,name,parent_id,tier,color,lexicon_ref) VALUES
 ('sweet-brown-sugar',     'Brown Sugar',    'sweet',2,'#E0922F',NULL),
 ('sweet-molasses',        'Molasses',       'sweet-brown-sugar',3,'#E0922F',NULL),
 ('sweet-maple',           'Maple Syrup',    'sweet-brown-sugar',3,'#E0922F',NULL),
 ('sweet-caramelized',     'Caramelized',    'sweet-brown-sugar',3,'#E0922F',NULL),
 ('sweet-honey',           'Honey',          'sweet-brown-sugar',3,'#E0922F',NULL),
 ('sweet-vanilla',         'Vanilla',        'sweet',2,'#E0922F',NULL),
 ('sweet-vanillin',        'Vanillin',       'sweet',2,'#E0922F',NULL),
 ('sweet-overall',         'Overall Sweet',  'sweet',2,'#E0922F',NULL),
 ('sweet-aromatics',       'Sweet Aromatics','sweet',2,'#E0922F',NULL);

