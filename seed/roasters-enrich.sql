-- seed :: roaster enrichment — about prose + founded + instagram for notable roasters.
-- Our own concise factual descriptions (not copied marketing). founded only where
-- confident. INSERT Loquat + Kumquat (LA); UPDATE the rest. confidence stays as-is.

-- ── Loquat + Kumquat (Los Angeles) ──────────────────────────────────
INSERT OR IGNORE INTO ref_roasters (id,name,city,country_code,website,source,confidence,updated_at) VALUES
 ('loquat','Loquat Coffee','Los Angeles','US','https://www.loquatcoffee.com','general_knowledge','high','2026-06-03'),
 ('kumquat','Kumquat Coffee','Los Angeles','US','https://www.kumquatcoffee.com','general_knowledge','high','2026-06-03');

UPDATE ref_roasters SET about='The house-roasting label and Cypress Park coffee bar from the team behind Kumquat. Roasts small batches of direct-trade, micro-lot and Cup of Excellence-grade coffees on a Diedrich IR-7 in-shop, with larger production on a Loring S15.', founded='2022', instagram='loquatcoffee', updated_at='2026-06-03' WHERE id='loquat';
UPDATE ref_roasters SET about='An influential Los Angeles multiroaster coffee bar in Highland Park, pouring rotating selections from many of the world''s best roasters across the US, Japan, Korea, Denmark, Australia and beyond. Sibling to the Loquat house-roasting label.', founded='2018', instagram='kumquatcoffee', updated_at='2026-06-03' WHERE id='kumquat';

-- ── Notable roasters: our-own-words descriptions + founded where confident ──
UPDATE ref_roasters SET about='Pioneering Oslo micro-roaster and farm-direct importer; one of the most influential names in light-roast, traceable specialty coffee.', founded='2007', instagram='timwendelboe' WHERE id='tim-wendelboe';
UPDATE ref_roasters SET about='Copenhagen roaster and café group co-founded by World Barista champions; a benchmark for transparent, sustainable sourcing.', founded='2007', instagram='coffeecollective' WHERE id='coffee-collective';
UPDATE ref_roasters SET about='Aarhus-born Danish roaster known for an exceptionally clean, light, modern style and minimalist cafés.', founded='2012', instagram='lacabracoffee' WHERE id='la-cabra';
UPDATE ref_roasters SET about='Copenhagen roaster founded by champion barista Patrik Rolf, celebrated for delicate, high-clarity light roasts.', founded='2017', instagram='aprilcoffeeroasters' WHERE id='april';
UPDATE ref_roasters SET about='Berlin roaster and café, an early standard-bearer for the European light-roast, single-origin movement.', founded='2010', instagram='thebarncoffee' WHERE id='the-barn';
UPDATE ref_roasters SET about='London roaster founded by World Barista and Cup Tasters champions; long-time roaster for the UK Barista Championship.', founded='2008', instagram='squaremilecoffee' WHERE id='square-mile';
UPDATE ref_roasters SET about='Brooklyn roaster known for vivid, fruit-forward light roasts and a design-led aesthetic.', founded='2013', instagram='seycoffee' WHERE id='sey';
UPDATE ref_roasters SET about='Massachusetts roaster led by specialty pioneer George Howell, famed for terroir-driven coffees and the Terroir selection.', founded='2004', instagram='georgehowellcoffee' WHERE id='george-howell';
UPDATE ref_roasters SET about='Portland, Oregon roaster with a long-standing reputation for clean, expressive single origins.', founded='2009', instagram='heartroasters' WHERE id='heart';
UPDATE ref_roasters SET about='Arkansas roaster and multi-time US Barista Champion operation, known for competition-grade coffees and exacting quality.', founded='2012', instagram='onyxcoffeelab' WHERE id='onyx';
UPDATE ref_roasters SET about='Lancaster, Pennsylvania roaster recognized for polished, sweetness-forward coffees and strong competition results.', founded='2009', instagram='passengercoffee' WHERE id='passenger';
UPDATE ref_roasters SET about='North Carolina roaster co-founded by a US Barista Champion, known for playful branding and clean, modern roasting.', founded='2016', instagram='blackwhiteroasters' WHERE id='black-white';
UPDATE ref_roasters SET about='Amsterdam roaster known for bright, expressive light roasts and competition pedigree.', founded='2016', instagram='friedhats' WHERE id='friedhats';
UPDATE ref_roasters SET about='Helsingborg, Sweden roaster founded by champion baristas, known for elegant Nordic-style light roasts.', founded='2007', instagram='koppi' WHERE id='koppi';
UPDATE ref_roasters SET about='Chicago institution and one of American specialty coffee''s foundational third-wave roasters.', founded='1995', instagram='intelligentsiacoffee' WHERE id='intelligentsia';
UPDATE ref_roasters SET about='Durham, North Carolina roaster known for sustainability leadership, education and transparent sourcing.', founded='1995', instagram='counterculturecoffee' WHERE id='counter-culture';
UPDATE ref_roasters SET about='Portland, Oregon roaster that helped define West Coast third-wave coffee and the modern café.', founded='1999', instagram='stumptowncoffee' WHERE id='stumptown';
UPDATE ref_roasters SET about='Bay Area roaster known for meticulous sourcing, freshness and a design-forward brand.', founded='2002', instagram='bluebottle' WHERE id='blue-bottle';
UPDATE ref_roasters SET about='Santa Cruz, California roaster and café group with a strong farm-direct sourcing program.', founded='2007', instagram='vervecoffee' WHERE id='verve';
UPDATE ref_roasters SET about='San Francisco roaster and café known for thoughtful single origins and a strong design identity.', founded='2009', instagram='sightglass' WHERE id='sightglass';
UPDATE ref_roasters SET about='Brooklyn roaster sourcing exclusively Colombian coffee, fresh-imported and roasted for clarity.', founded='2006', instagram='devocion' WHERE id='devocion';
UPDATE ref_roasters SET about='Boulder, Colorado roaster from a US Roaster and Barista champion, focused on high-scoring, expressive lots.', founded='2021', instagram='getprodigal' WHERE id='prodigal';
UPDATE ref_roasters SET about='Lakewood, Colorado roaster known for sweetness-driven, approachable yet high-quality single origins.', founded='2014', instagram='sweetbloomcoffee' WHERE id='sweet-bloom';
UPDATE ref_roasters SET about='Historic London roaster and Borough Market institution, a cornerstone of UK specialty coffee.', founded='1978', instagram='monmouthcoffee' WHERE id='monmouth';
UPDATE ref_roasters SET about='London roaster known for precise, modern light roasting and an espresso-forward program.', founded='2011', instagram='workshopcoffee' WHERE id='workshop';
UPDATE ref_roasters SET about='Cornwall-based roaster and B-Corp, one of the UK''s most respected specialty names.', founded='2004', instagram='origincoffeeuk' WHERE id='origin';
UPDATE ref_roasters SET about='London roaster and café group known for consistent quality and a strong wholesale program.', founded='2009', instagram='ozonecoffeeuk' WHERE id='ozone';
UPDATE ref_roasters SET about='London roaster and café from New Zealand founders, an early UK third-wave standard-bearer.', founded='2008', instagram='caravanroastery' WHERE id='caravan';
UPDATE ref_roasters SET about='Dublin roaster and café from barista champion Colin Harmon; a leading Irish specialty name.', founded='2009', instagram='3fecoffee' WHERE id='3fe';
UPDATE ref_roasters SET about='Italy''s most internationally awarded specialty roaster, based in Forlì and known for experimental, high-scoring lots.', founded='2015', instagram='gardellicoffee' WHERE id='gardelli';
UPDATE ref_roasters SET about='Berlin roaster known for impeccable light roasts and a flagship café in Kreuzberg.', founded='2011', instagram='bonanzacoffeeroasters' WHERE id='bonanza';
UPDATE ref_roasters SET about='Berlin roaster and café celebrated for its Ethiopian and Colombian sourcing and a beloved cheesecake.', founded='2011', instagram='fiveelephant' WHERE id='five-elephant';
UPDATE ref_roasters SET about='Stockholm roaster, multiple Swedish champions, known for crisp, bright Nordic light roasts.', founded='2009', instagram='dropcoffee' WHERE id='drop-coffee';
UPDATE ref_roasters SET about='Melbourne roaster and café group, a pillar of Australian specialty with strong producer relationships.', founded='2009', instagram='marketlane' WHERE id='market-lane';
UPDATE ref_roasters SET about='Melbourne roaster from Mark Dundon, deeply influential in Australian specialty sourcing and roasting.', founded='2007', instagram='sevenseeds' WHERE id='seven-seeds';
UPDATE ref_roasters SET about='Canberra roaster and competition powerhouse behind numerous Australian champions and Project Origin.', founded='2007', instagram='onacoffee' WHERE id='ona';
UPDATE ref_roasters SET about='Kyoto-born global café brand known for its minimalist white aesthetic and the % logo.', founded='2014', instagram='arabica' WHERE id='arabica';
UPDATE ref_roasters SET about='Tokyo roaster and café group known for clean, modern light roasting and neighborhood cafés.', founded='2012', instagram='onibuscoffee' WHERE id='onibus';
UPDATE ref_roasters SET about='Tokyo roaster known for elegant, high-clarity light roasts in a refined Marunouchi space.', founded='2015', instagram='glitch_coffee' WHERE id='glitch';
UPDATE ref_roasters SET about='Singapore micro-roaster known for precise, delicate light roasts and a tiny Everton Park café.', founded='2012', instagram='nyloncoffee' WHERE id='nylon';
UPDATE ref_roasters SET about='Cape Town roaster and steampunk-themed café, a flagship of South African specialty coffee.', founded='2009', instagram='truthcoffee' WHERE id='truth';
UPDATE ref_roasters SET about='Calgary roaster, multiple Canadian champions, known for refined sourcing and roasting.', founded='2007', instagram='philsebastian' WHERE id='phil-sebastian';
UPDATE ref_roasters SET about='Toronto roaster and café group, one of Canada''s most prominent specialty names.', founded='2009', instagram='pilotcoffee' WHERE id='pilot';
UPDATE ref_roasters SET about='Amsterdam roaster known for bold creative branding and a strong rotating single-origin lineup.', founded='2017', instagram='dakcoffeeroasters' WHERE id='dak';
UPDATE ref_roasters SET about='Tokyo roaster founded by a World Brewers Cup champion, known for exceptionally clean, delicate roasting.', founded='2017', instagram='leavescoffee' WHERE id='leaves';
