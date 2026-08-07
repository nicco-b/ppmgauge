-- seed :: roaster/bag synonyms for flavor-wheel notes -> ref_flavors.aliases
-- Bridges the gap between the controlled SCA vocabulary and the free-form,
-- more-specific language roasters print on bags ("white peach" -> Peach).
-- JSON array of lowercase strings. Run AFTER flavor-wheel.sql (which, being
-- INSERT OR REPLACE, would otherwise reset these to NULL). UPDATEs are re-runnable.
-- Lossy by design: tropical fruits with no wheel home are mapped to their nearest
-- node so they at least resolve; the literal bag text is preserved elsewhere.

-- ── Fruity ──
UPDATE ref_flavors SET aliases='["bramble"]' WHERE id='fruity-blackberry';
UPDATE ref_flavors SET aliases='["jammy","berry","mixed berry"]' WHERE id='fruity-berry';
UPDATE ref_flavors SET aliases='["sultana","currant"]' WHERE id='fruity-raisin';
UPDATE ref_flavors SET aliases='["black cherry","bing cherry","maraschino","dark cherry"]' WHERE id='fruity-cherry';
UPDATE ref_flavors SET aliases='["red grape","concord grape","grape soda"]' WHERE id='fruity-grape';
UPDATE ref_flavors SET aliases='["green apple","red apple","apple cider","fuji"]' WHERE id='fruity-apple';
UPDATE ref_flavors SET aliases='["white peach","yellow peach","nectarine","apricot","stone fruit"]' WHERE id='fruity-peach';
UPDATE ref_flavors SET aliases='["tropical","tropical fruit","mango","passion fruit","passionfruit","lychee","guava","papaya"]' WHERE id='fruity-pineapple';
UPDATE ref_flavors SET aliases='["pink grapefruit","ruby grapefruit"]' WHERE id='fruity-grapefruit';
UPDATE ref_flavors SET aliases='["mandarin","tangerine","clementine","orange zest","blood orange"]' WHERE id='fruity-orange';
UPDATE ref_flavors SET aliases='["lemon zest","meyer lemon","lemonade"]' WHERE id='fruity-lemon';
UPDATE ref_flavors SET aliases='["key lime","limeade"]' WHERE id='fruity-lime';
UPDATE ref_flavors SET aliases='["citrus","citrusy"]' WHERE id='fruity-citrus';
UPDATE ref_flavors SET aliases='["dried fruit"]' WHERE id='fruity-dried';

-- ── Floral ──
UPDATE ref_flavors SET aliases='["floral","flowers","elderflower","honeysuckle","lavender","orange blossom","hibiscus"]' WHERE id='floral-floral';
UPDATE ref_flavors SET aliases='["rosewater","rose water","rose hip"]' WHERE id='floral-rose';
UPDATE ref_flavors SET aliases='["earl grey","bergamot","tea","tea-like","black tea"]' WHERE id='floral-black-tea';

-- ── Sweet ──
UPDATE ref_flavors SET aliases='["caramel","toffee","butterscotch","burnt sugar","creme brulee","dulce de leche"]' WHERE id='sweet-caramelized';
UPDATE ref_flavors SET aliases='["honey","honeyed"]' WHERE id='sweet-honey';
UPDATE ref_flavors SET aliases='["maple","maple syrup"]' WHERE id='sweet-maple';
UPDATE ref_flavors SET aliases='["molasses","treacle"]' WHERE id='sweet-molasses';
UPDATE ref_flavors SET aliases='["brown sugar","muscovado","panela","raw sugar"]' WHERE id='sweet-brown-sugar';
UPDATE ref_flavors SET aliases='["vanilla bean","vanilla"]' WHERE id='sweet-vanilla';
UPDATE ref_flavors SET aliases='["sweet","sugary"]' WHERE id='sweet-overall';

-- ── Nutty / Cocoa ──
UPDATE ref_flavors SET aliases='["milk chocolate","chocolatey","cacao"]' WHERE id='nc-chocolate';
UPDATE ref_flavors SET aliases='["dark chocolate","bittersweet chocolate","70%","cocoa nibs","fudge"]' WHERE id='nc-dark-chocolate';
UPDATE ref_flavors SET aliases='["cocoa","cocoa powder"]' WHERE id='nc-cocoa';
UPDATE ref_flavors SET aliases='["hazelnut","nutella","praline"]' WHERE id='nc-hazelnut';
UPDATE ref_flavors SET aliases='["almond","marzipan","amaretto"]' WHERE id='nc-almond';
UPDATE ref_flavors SET aliases='["peanut","peanut butter"]' WHERE id='nc-peanuts';
UPDATE ref_flavors SET aliases='["nutty","nuts","walnut","pecan"]' WHERE id='nc-nutty';

-- ── Roasted ──
UPDATE ref_flavors SET aliases='["malt","malty","graham cracker","biscuit","digestive","shortbread","toast"]' WHERE id='roasted-malt';
UPDATE ref_flavors SET aliases='["grain","cereal","bready","granola"]' WHERE id='roasted-grain';
UPDATE ref_flavors SET aliases='["tobacco","cigar","pipe"]' WHERE id='roasted-tobacco';
UPDATE ref_flavors SET aliases='["smoke","smoky"]' WHERE id='roasted-smoky';
UPDATE ref_flavors SET aliases='["roasty","dark roast"]' WHERE id='roasted-brown';

-- ── Spices ──
UPDATE ref_flavors SET aliases='["cinnamon"]' WHERE id='spices-cinnamon';
UPDATE ref_flavors SET aliases='["clove"]' WHERE id='spices-clove';
UPDATE ref_flavors SET aliases='["nutmeg"]' WHERE id='spices-nutmeg';
UPDATE ref_flavors SET aliases='["anise","licorice","star anise","fennel"]' WHERE id='spices-anise';
UPDATE ref_flavors SET aliases='["black pepper","white pepper","peppercorn"]' WHERE id='spices-pepper';
UPDATE ref_flavors SET aliases='["baking spice","chai","gingerbread","spice","spicy","ginger"]' WHERE id='spices-brown-spice';

-- ── Sour / Fermented ──
UPDATE ref_flavors SET aliases='["wine","red wine","winey","vinous"]' WHERE id='sf-winey';
UPDATE ref_flavors SET aliases='["whiskey","rum","brandy","boozy"]' WHERE id='sf-whiskey';
UPDATE ref_flavors SET aliases='["fermented","funky","boozy"]' WHERE id='sf-ferment';
UPDATE ref_flavors SET aliases='["citric","citric acid"]' WHERE id='sf-citric';
UPDATE ref_flavors SET aliases='["malic","malic acid","green apple acidity"]' WHERE id='sf-malic';
UPDATE ref_flavors SET aliases='["sour","tart","tangy"]' WHERE id='sf-sour-aromatics';
UPDATE ref_flavors SET aliases='["overripe","jammy"]' WHERE id='sf-overripe';

-- ── Green / Vegetative ──
UPDATE ref_flavors SET aliases='["herbal","herbaceous","mint","minty","basil","thyme"]' WHERE id='gv-herb';
UPDATE ref_flavors SET aliases='["hay","straw"]' WHERE id='gv-hay';
UPDATE ref_flavors SET aliases='["green","grassy","grass"]' WHERE id='gv-vegetative';
UPDATE ref_flavors SET aliases='["pea","snap pea","green pea"]' WHERE id='gv-peapod';
