-- seed :: processing methods -> ref_processes
-- explainer = "what actually happens" for the in-context learning popover.
-- flavor_effect = the cup signature. category groups for filtering/coloring.


INSERT OR REPLACE INTO ref_processes (id,name,category,explainer,flavor_effect,aliases,updated_at) VALUES
 ('washed','Washed','washed',
  'Fruit skin and pulp are removed, then the sticky mucilage is fermented and washed off before drying the bare parchment. The seed never dries inside its fruit, so the cup reflects the bean and terroir rather than the fruit.',
  'Clean, bright, high clarity; acidity-forward','["fully washed","wet process","wet"]','2026-05-31'),
 ('natural','Natural','natural',
  'The whole cherry is dried intact in the sun, fruit and all, for weeks. Sugars and aromatics migrate from the drying fruit into the seed.',
  'Heavy body, fruity, sweet, sometimes boozy','["dry process","unwashed","dry"]','2026-05-31'),
 ('honey','Honey','honey',
  'Skin is removed but some mucilage is left clinging to the parchment during drying. The amount left (and the resulting color) sets the style.',
  'Rounded sweetness between washed clarity and natural fruit','["pulped natural","miel","semi-washed"]','2026-05-31'),
 ('white-honey','White Honey','honey',
  'Honey process with almost all mucilage removed before drying — closest to washed.',
  'Mostly clean with a touch of extra sweetness','["honey blanco"]','2026-05-31'),
 ('yellow-honey','Yellow Honey','honey',
  'Honey process with a moderate amount of mucilage left on the parchment.',
  'Balanced sweetness and clarity','[]','2026-05-31'),
 ('red-honey','Red Honey','honey',
  'Honey process leaving more mucilage and slower drying, deepening color and sweetness.',
  'Syrupy sweetness, soft acidity','[]','2026-05-31'),
 ('black-honey','Black Honey','honey',
  'Honey process leaving nearly all mucilage with the slowest, most shaded drying — closest to natural.',
  'Dense fruit sweetness, low acidity','[]','2026-05-31'),
 ('anaerobic','Anaerobic','experimental',
  'Cherries (or depulped beans) ferment in sealed oxygen-free tanks. CO2 builds up and different microbes dominate, generating intense new aromatics before drying.',
  'Intense, funky, fruit-forward, often boozy','["anaerobic fermentation"]','2026-05-31'),
 ('anaerobic-natural','Anaerobic Natural','experimental',
  'Whole cherries undergo sealed oxygen-free fermentation, then are dried as a natural.',
  'Big fruit, wine/booze notes, high intensity','[]','2026-05-31'),
 ('carbonic-maceration','Carbonic Maceration','experimental',
  'Borrowed from winemaking: whole cherries ferment under a CO2 blanket, fermenting from inside each fruit before processing.',
  'Vivid, clean fruit; distinctive aromatics','["CM"]','2026-05-31'),
 ('wet-hulled','Wet-Hulled','washed',
  'Indonesian method: parchment is hulled off while the bean is still wet (~30-40% moisture), then drying finishes on the bare bean.',
  'Heavy body, low acidity, earthy/herbal, cedar','["giling basah","semi-washed (Sumatra)"]','2026-05-31'),
 ('decaf-swiss-water','Decaf — Swiss Water','washed',
  'Chemical-free decaffeination: green beans soak in a caffeine-saturated water extract so caffeine leaves but flavor compounds stay.',
  'Retains origin character; slightly muted','["SWP"]','2026-05-31');

