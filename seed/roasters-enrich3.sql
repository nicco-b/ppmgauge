-- seed :: roaster enrichment batch 3 — remaining long tail. Our-own-words; UPDATE-only,
-- guarded by about IS NULL. Only roasters I can describe accurately; obscure ones left as-is.

-- US
UPDATE ref_roasters SET about='San Francisco roaster and café, a foundational name in the city''s third-wave coffee scene.', founded='2005' WHERE id='ritual' AND about IS NULL;
UPDATE ref_roasters SET about='Portland, Maine roaster and café known for sweetness-forward roasting and acclaimed baking.', founded='2012' WHERE id='tandem' AND about IS NULL;
UPDATE ref_roasters SET about='Long-running New York State roaster (Ithaca) and café, an early Northeast specialty name.', founded='2000' WHERE id='gimme' AND about IS NULL;
UPDATE ref_roasters SET about='Nashville roaster and café group known for approachable, well-sourced specialty coffee.' WHERE id='crema' AND about IS NULL;
UPDATE ref_roasters SET about='Philadelphia roaster and café known for a clean, modern house style.' WHERE id='elixr' AND about IS NULL;
UPDATE ref_roasters SET about='San Francisco roaster known for bright, expressive light roasting and a strong online presence.' WHERE id='hydrangea' AND about IS NULL;
UPDATE ref_roasters SET about='Bellingham, Washington roaster known for clean, modern light roasting.' WHERE id='camber' AND about IS NULL;
UPDATE ref_roasters SET about='Cleveland roaster known for competition-grade, light-roasted single origins.' WHERE id='subtext' AND about IS NULL;
UPDATE ref_roasters SET about='San Diego roaster known for vivid, fruit-forward roasting.' WHERE id='color' AND about IS NULL;
UPDATE ref_roasters SET about='Philadelphia roaster known for adventurous, light-roasted and experimental lots.' WHERE id='vibrant' AND about IS NULL;
UPDATE ref_roasters SET about='Portland, Oregon roaster known for clean, balanced single origins.' WHERE id='roseline' AND about IS NULL;
UPDATE ref_roasters SET about='Dallas roaster and café known for modern, well-sourced specialty coffee.' WHERE id='speedwell' AND about IS NULL;
UPDATE ref_roasters SET about='Louisville, Kentucky roaster and café, a long-running regional specialty name.' WHERE id='quills' AND about IS NULL;
UPDATE ref_roasters SET about='St. Louis roaster known for clean, transparent single origins.' WHERE id='blueprint' AND about IS NULL;
UPDATE ref_roasters SET about='Western Massachusetts roaster, one of the Northeast''s longest-running specialty operations.', founded='1993' WHERE id='barrington' AND about IS NULL;
UPDATE ref_roasters SET about='Florida Panhandle roaster and café focused on fair-trade, organic specialty coffee.' WHERE id='amavida' AND about IS NULL;
UPDATE ref_roasters SET about='Redlands, California roaster and café group with a strong Southern California following.' WHERE id='augies' AND about IS NULL;
UPDATE ref_roasters SET about='Ipswich, Massachusetts roaster known for clean, thoughtful single origins.' WHERE id='little-wolf' AND about IS NULL;
UPDATE ref_roasters SET about='San Francisco roaster known for a refined, design-led approach to single origins.' WHERE id='mother-tongue' AND about IS NULL;
UPDATE ref_roasters SET about='San Francisco roaster from the team behind Tartine, focused on high-end sourcing.' WHERE id='coffee-manufactory' AND about IS NULL;
UPDATE ref_roasters SET about='New York City roaster and café group with a strong sourcing and education program.' WHERE id='coffee-project-ny' AND about IS NULL;
UPDATE ref_roasters SET about='Kansas City roaster and café known for modern roasting and a large flagship space.' WHERE id='messenger' AND about IS NULL;
UPDATE ref_roasters SET about='Austin roaster and café known for laid-back, well-roasted specialty coffee.' WHERE id='flat-track' AND about IS NULL;
UPDATE ref_roasters SET about='New Jersey/New York roaster known for high-end, competition-grade and rare lots.' WHERE id='regalia' AND about IS NULL;
-- UK / Ireland
UPDATE ref_roasters SET about='Stafford-based roaster, one of the UK''s pioneering online specialty roasters.', founded='2004' WHERE id='has-bean' AND about IS NULL;
UPDATE ref_roasters SET about='London roaster known for dependable, well-roasted specialty coffee and espresso.' WHERE id='volcano' AND about IS NULL;
UPDATE ref_roasters SET about='Lancaster roaster and café, a long-established northern English specialty name.' WHERE id='atkinsons' AND about IS NULL;
UPDATE ref_roasters SET about='Manchester roaster and café known for modern roasting and design-led spaces.' WHERE id='grindsmith' AND about IS NULL;
UPDATE ref_roasters SET about='Rutland roaster known for playful branding and approachable specialty coffee.' WHERE id='two-chimps' AND about IS NULL;
UPDATE ref_roasters SET about='Welsh roaster (Ammanford) known for ethical sourcing and community focus.' WHERE id='coaltown' AND about IS NULL;
UPDATE ref_roasters SET about='Exeter roaster known for bright, expressive light roasting.' WHERE id='crankhouse' AND about IS NULL;
UPDATE ref_roasters SET about='Brighton roaster known for clean, modern light roasting.' WHERE id='skylark' AND about IS NULL;
UPDATE ref_roasters SET about='Margate roaster (Curve Coffee) known for a contemporary, design-led approach.' WHERE id='prodigal-uk' AND about IS NULL;
UPDATE ref_roasters SET about='Somerset roaster (Bath) known for thoughtful sourcing and clean roasting.' WHERE id='round-hill' AND about IS NULL;
-- Europe
UPDATE ref_roasters SET about='Pioneering Paris roaster, a driving force in France''s specialty coffee movement.', founded='2013' WHERE id='belleville' AND about IS NULL;
UPDATE ref_roasters SET about='Paris roaster and café, an early standard-bearer for French specialty coffee.', founded='2011' WHERE id='coutume' AND about IS NULL;
UPDATE ref_roasters SET about='Munich roaster and café known for clean, modern light roasting.' WHERE id='man-versus-machine' AND about IS NULL;
UPDATE ref_roasters SET about='Gothenburg roaster, bakery and café, a cornerstone of Swedish specialty coffee.' WHERE id='da-matteo' AND about IS NULL;
UPDATE ref_roasters SET about='Helsinki roaster and café, a leading name in Finnish specialty coffee.' WHERE id='good-life' AND about IS NULL;
UPDATE ref_roasters SET about='Stockholm roaster, one of Sweden''s established specialty names with strong sustainability roots.' WHERE id='johan-nystrom' AND about IS NULL;
UPDATE ref_roasters SET about='Oslo roaster and green-coffee importer, one of Norway''s oldest and most respected coffee houses.' WHERE id='solberg-hansen' AND about IS NULL;
UPDATE ref_roasters SET about='Oslo roaster founded by Tim Wendelboe alumni, known for clean, modern Nordic roasting.' WHERE id='supreme-roastworks' AND about IS NULL;
UPDATE ref_roasters SET about='Oslo roaster founded by a World Barista Champion, an influential Norwegian specialty name.' WHERE id='kaffa' AND about IS NULL;
UPDATE ref_roasters SET about='Oslo-born café and roaster with a vintage Scandinavian aesthetic and outposts in Tokyo.' WHERE id='fuglen-oslo' AND about IS NULL;
UPDATE ref_roasters SET about='Stockholm café and roaster known for a clean, contemporary house style.' WHERE id='kaffeverket' AND about IS NULL;
UPDATE ref_roasters SET about='Swedish roaster (Lykke Kaffegårdar) known for organic, sustainability-focused coffee.' WHERE id='lykke' AND about IS NULL;
UPDATE ref_roasters SET about='Stockholm roaster known for ultra-rare, experimental and high-priced micro-lots.' WHERE id='coffee-nature' AND about IS NULL;
UPDATE ref_roasters SET about='Leuven, Belgium roaster and café, a leading Belgian specialty name.' WHERE id='mok' AND about IS NULL;
UPDATE ref_roasters SET about='Madrid roaster and café, a driving force in Spain''s specialty coffee scene.' WHERE id='tornador' AND about IS NULL;
UPDATE ref_roasters SET about='Madrid roaster and café known for clean, modern specialty coffee.' WHERE id='hola-coffee' AND about IS NULL;
UPDATE ref_roasters SET about='Barcelona roaster known for bright, contemporary light roasting.' WHERE id='three-marks' AND about IS NULL;
UPDATE ref_roasters SET about='Rotterdam roaster, a multiple-champion operation known for refined, modern roasting.' WHERE id='manhattan' AND about IS NULL;
UPDATE ref_roasters SET about='Amsterdam roaster and café known for a clean, modern single-origin program.' WHERE id='white-label' AND about IS NULL;
UPDATE ref_roasters SET about='Amsterdam roaster known for bright, expressive light roasting.' WHERE id='sweet-science' AND about IS NULL;
UPDATE ref_roasters SET about='Florence roaster and café from Francesco Sanapo, a pioneer of Italian specialty coffee.', founded='2013' WHERE id='ditta-artigianale' AND about IS NULL;
-- Asia / Oceania
UPDATE ref_roasters SET about='Sydney roaster, a long-running pillar of Australian specialty coffee and a sustainability leader.', founded='2003' WHERE id='single-o' AND about IS NULL;
UPDATE ref_roasters SET about='Melbourne roaster from Nolan Hirte, known for vibrant roasting and an outpost in Portland, Oregon.', founded='2009' WHERE id='proud-mary' AND about IS NULL;
UPDATE ref_roasters SET about='Perth- and Melbourne-based roaster, a well-established Australian specialty name.', founded='2004' WHERE id='five-senses' AND about IS NULL;
UPDATE ref_roasters SET about='Melbourne roaster from Dave Makin, a competition powerhouse and respected Australian name.' WHERE id='axil' AND about IS NULL;
UPDATE ref_roasters SET about='Melbourne roaster known for consistent, well-crafted specialty coffee.' WHERE id='small-batch' AND about IS NULL;
UPDATE ref_roasters SET about='Melbourne roaster and café group with deep roots in the city''s coffee culture.' WHERE id='dukes' AND about IS NULL;
UPDATE ref_roasters SET about='Sydney roaster known for clean, modern specialty coffee.' WHERE id='alma' AND about IS NULL;
UPDATE ref_roasters SET about='Sydney roaster known for a bright, contemporary house style.' WHERE id='rabbit-hole' AND about IS NULL;
UPDATE ref_roasters SET about='Melbourne roaster and café known for thoughtful, well-roasted coffee.' WHERE id='wood-and-co' AND about IS NULL;
UPDATE ref_roasters SET about='Wellington roaster, one of New Zealand''s established specialty names.', founded='1993' WHERE id='coffee-supreme' AND about IS NULL;
UPDATE ref_roasters SET about='Wellington roaster known for competition pedigree and modern roasting.' WHERE id='flight' AND about IS NULL;
UPDATE ref_roasters SET about='Taipei roaster from 2016 World Barista Champion Berg Wu, one of Asia''s most celebrated coffee names.', founded='2013' WHERE id='simple-kaffa' AND about IS NULL;
UPDATE ref_roasters SET about='Seoul roaster, one of Korea''s most prominent and influential specialty coffee names.' WHERE id='fritz' AND about IS NULL;
UPDATE ref_roasters SET about='Tokyo roaster and café (by Nozy Coffee) known for single-origin focus.' WHERE id='the-roastery' AND about IS NULL;
UPDATE ref_roasters SET about='Fukuoka roaster and café, a respected name in Japanese specialty coffee.' WHERE id='coffee-county' AND about IS NULL;
UPDATE ref_roasters SET about='Tokyo roaster and café known for bright, modern light roasting.' WHERE id='light-up' AND about IS NULL;
UPDATE ref_roasters SET about='Singapore roaster and café, a leading name in the city''s specialty scene.' WHERE id='common-man' AND about IS NULL;
UPDATE ref_roasters SET about='Hong Kong roaster and café group known for a polished, design-led approach.' WHERE id='the-coffee-academics' AND about IS NULL;
UPDATE ref_roasters SET about='Bangkok roaster and café showcasing Thai-grown and imported specialty coffee.' WHERE id='roots' AND about IS NULL;
-- Africa
UPDATE ref_roasters SET about='Johannesburg roaster and café, a prominent South African specialty name.' WHERE id='father-coffee' AND about IS NULL;
UPDATE ref_roasters SET about='Cape Town roaster known for refined, modern roasting and a strong design identity.' WHERE id='rosetta' AND about IS NULL;
