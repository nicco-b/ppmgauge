-- seed :: coffee glossary -> ref_glossary
-- Curated educational content for the "learning" side of the app. These are
-- standard, well-established specialty-coffee terms — high confidence.
-- category: 'agronomy' | 'processing' | 'sensory' | 'brewing'
-- related = JSON array of other slugs (powers "see also" links).


INSERT OR REPLACE INTO ref_glossary (slug,term,definition,category,related) VALUES
 ('cherry','Coffee Cherry','The fruit of the coffee plant. Each cherry usually holds two seeds (the beans). Ripeness at picking is one of the biggest drivers of cup quality.','agronomy','["parchment","mucilage","peaberry"]'),
 ('parchment','Parchment','The papery endocarp layer surrounding the green bean. Coffee is often stored and shipped "in parchment" and hulled just before export to protect the seed.','agronomy','["cherry","wet-hulled","mucilage"]'),
 ('mucilage','Mucilage','The sticky, sugar-rich layer between the cherry skin and the parchment. How much is removed or fermented defines washed vs honey vs natural processing.','processing','["honey","washed","fermentation"]'),
 ('peaberry','Peaberry','A natural mutation where the cherry develops a single round seed instead of two flat ones. Often sorted out and sold separately (e.g. Kenyan "PB").','agronomy','["cherry"]'),
 ('landrace','Landrace','A locally adapted, genetically diverse population of a crop, not a single bred variety. Ethiopia''s indigenous "heirloom" coffees are landraces.','agronomy','["varietal","terroir"]'),
 ('varietal','Variety (Varietal)','A distinct cultivated type within a coffee species (e.g. Bourbon, Gesha). Strictly "variety" for the plant; "varietal" is common in the trade.','agronomy','["landrace","terroir"]'),
 ('terroir','Terroir','The combined effect of place — soil, altitude, climate, shade — on how a coffee tastes. Borrowed from wine.','agronomy','["varietal","altitude"]'),
 ('altitude','Altitude (masl)','Metres above sea level where coffee grows. Higher, cooler altitudes slow cherry maturation, generally building density, acidity and complexity.','agronomy','["terroir"]'),
 ('washing-station','Washing Station','A central wet mill where smallholders deliver cherry to be pulped, fermented and washed together. Common in East Africa; often the real "producer" of a lot.','processing','["washed","fermentation"]'),
 ('fermentation','Fermentation','The controlled microbial breakdown of mucilage sugars. Time, temperature and oxygen (e.g. anaerobic) shape acidity and aromatics.','processing','["mucilage","anaerobic","washed"]'),
 ('cascara','Cascara','The dried skin and pulp of the coffee cherry, brewed as a tea-like infusion. A by-product of processing.','processing','["cherry","natural"]'),
 ('defect','Defect','A physical fault in green coffee (e.g. black, sour, broken beans, or quakers). Defect count drives green grading and cup cleanliness.','sensory','["clean-cup","quaker"]'),
 ('quaker','Quaker','An under-developed bean that fails to brown in the roast, tasting papery or peanutty. A roast-visible defect.','sensory','["defect","roast-level"]'),
 ('q-grader','Q Grader','A licensed coffee taster certified by the Coffee Quality Institute to score arabica on the standardized SCA scale. The professional palate credential.','sensory','["cupping","sca-score"]'),
 ('cupping','Cupping','The standardized tasting protocol — ground coffee steeped in hot water, crust broken and slurped — used to evaluate and compare coffees objectively.','sensory','["q-grader","sca-score","fragrance-aroma"]'),
 ('sca-score','SCA Cupping Score','A 100-point quality scale. 80+ is "specialty"; 90+ is exceptional. Built from ten attributes (flavor, acidity, body, balance, etc.).','sensory','["cupping","q-grader","specialty-coffee"]'),
 ('specialty-coffee','Specialty Coffee','Coffee scoring 80+ on the SCA scale, traceable and produced with quality intent at every step from seed to cup.','sensory','["sca-score"]'),
 ('fragrance-aroma','Fragrance & Aroma','Fragrance is the smell of the dry grounds; aroma is the smell once wet. The first attributes assessed in a cupping.','sensory','["cupping"]'),
 ('body','Body','The tactile weight or texture of the coffee in the mouth — from tea-like and silky to syrupy and heavy.','sensory','["mouthfeel"]'),
 ('acidity','Acidity','The bright, tangy, lively quality of a coffee — a prized trait in specialty when it''s sweet and structured rather than sour.','sensory','["sca-score"]'),
 ('aftertaste','Aftertaste','The flavor and sensation that lingers after swallowing. Length and pleasantness both count.','sensory','["sca-score"]'),
 ('clean-cup','Clean Cup','Freedom from any off-flavors or defects — a transparent cup where origin character shows through clearly.','sensory','["defect","sca-score"]'),
 ('flavor-wheel','Coffee Flavor Wheel','The SCA/WCR diagram organizing tasting vocabulary from broad categories (fruity, floral) to specific descriptors (blackberry, jasmine). A shared sensory language.','sensory','["sensory-lexicon","cupping"]'),
 ('sensory-lexicon','WCR Sensory Lexicon','The research-grade reference defining each coffee flavor attribute with physical reference samples and intensity anchors. The science behind the flavor wheel.','sensory','["flavor-wheel"]'),
 ('tds','TDS (Total Dissolved Solids)','The percentage of dissolved coffee material in the brewed liquid, read with a refractometer. The basis for measuring strength.','brewing','["extraction-yield","refractometer","brew-ratio"]'),
 ('extraction-yield','Extraction Yield','The percentage of the coffee grounds'' mass that dissolved into the brew. ~18–22% is the classic target window. Computed from TDS, dose and yield.','brewing','["tds","brew-ratio"]'),
 ('refractometer','Refractometer','A device measuring TDS by how the brew bends light. Turns brewing from guesswork into a measurable, repeatable process.','brewing','["tds","extraction-yield"]'),
 ('brew-ratio','Brew Ratio','The proportion of coffee to water (e.g. 1:16). Sets strength alongside grind and time.','brewing','["tds","extraction-yield"]'),
 ('bloom','Bloom','The initial pour that wets the grounds and releases trapped CO2, which foams up. Letting it degas improves even extraction.','brewing','["degassing","channeling"]'),
 ('degassing','Degassing','The release of CO2 from freshly roasted beans over days. Too fresh brews unevenly; "rest" lets flavors settle.','brewing','["bloom","roast-level"]'),
 ('channeling','Channeling','When water bores preferential paths through the coffee bed (especially in espresso), causing uneven, partly over/under extraction.','brewing','["extraction-yield"]'),
 ('roast-level','Roast Level','How far the beans were roasted, from light to dark. Lighter roasts preserve origin acidity and clarity; darker develop roast-driven, bittersweet flavors.','brewing','["degassing","first-crack","agtron"]'),
 ('first-crack','First Crack','The audible popping as beans expand and release moisture during roasting — the threshold of drinkable (light) roast.','brewing','["roast-level"]'),
 ('agtron','Agtron','A near-infrared scale measuring roast color/degree of development numerically, for consistent roast specification.','brewing','["roast-level"]'),
 ('mouthfeel','Mouthfeel','The overall tactile experience — body, texture, astringency — distinct from taste and aroma.','sensory','["body"]');

