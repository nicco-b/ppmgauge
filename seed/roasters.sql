-- seed :: notable specialty roasters -> ref_roasters
-- From widely-documented general knowledge — confidence='medium'. City/country are
-- well-known; treat as a starter directory to verify/expand, not authoritative.
--
-- ref_roasters.country_code REFERENCES ref_countries(code), so we first add the
-- CONSUMING countries (the producing-country seed only covers origins). These
-- legitimately belong in ref_countries; they simply have no harvest windows.


INSERT OR REPLACE INTO ref_countries (code,name,continent,hemisphere,aliases,updated_at) VALUES
 ('US','United States','North America','N','["USA"]','2026-05-31'),
 ('GB','United Kingdom','Europe','N','["UK"]','2026-05-31'),
 ('NO','Norway','Europe','N','[]','2026-05-31'),
 ('DK','Denmark','Europe','N','[]','2026-05-31'),
 ('DE','Germany','Europe','N','[]','2026-05-31'),
 ('NL','Netherlands','Europe','N','[]','2026-05-31'),
 ('SE','Sweden','Europe','N','[]','2026-05-31'),
 ('ES','Spain','Europe','N','[]','2026-05-31'),
 ('AU','Australia','Oceania','S','[]','2026-05-31'),
 ('CA','Canada','North America','N','[]','2026-05-31');

INSERT OR REPLACE INTO ref_roasters (id,name,city,country_code,website,source,confidence,updated_at) VALUES
 ('tim-wendelboe','Tim Wendelboe','Oslo','NO','https://timwendelboe.no','general_knowledge','medium','2026-05-31'),
 ('coffee-collective','The Coffee Collective','Copenhagen','DK','https://coffeecollective.dk','general_knowledge','medium','2026-05-31'),
 ('april','April Coffee Roasters','Copenhagen','DK','https://aprilcoffeeroasters.com','general_knowledge','medium','2026-05-31'),
 ('la-cabra','La Cabra','Aarhus','DK','https://lacabra.dk','general_knowledge','medium','2026-05-31'),
 ('the-barn','The Barn','Berlin','DE','https://thebarn.de','general_knowledge','medium','2026-05-31'),
 ('square-mile','Square Mile Coffee Roasters','London','GB','https://squaremilecoffee.com','general_knowledge','medium','2026-05-31'),
 ('sey','Sey Coffee','Brooklyn','US','https://seycoffee.com','general_knowledge','medium','2026-05-31'),
 ('george-howell','George Howell Coffee','Acton','US','https://georgehowellcoffee.com','general_knowledge','medium','2026-05-31'),
 ('onyx','Onyx Coffee Lab','Rogers','US','https://onyxcoffeelab.com','general_knowledge','medium','2026-05-31'),
 ('heart','Heart Coffee Roasters','Portland','US','https://heartroasters.com','general_knowledge','medium','2026-05-31'),
 ('black-white','Black & White Coffee Roasters','Wake Forest','US','https://blackwhiteroasters.com','general_knowledge','medium','2026-05-31'),
 ('passenger','Passenger Coffee','Lancaster','US','https://passengercoffee.com','general_knowledge','medium','2026-05-31'),
 ('proud-mary','Proud Mary Coffee','Melbourne','AU','https://proudmarycoffee.com.au','general_knowledge','medium','2026-05-31'),
 ('manhattan','Manhattan Coffee Roasters','Rotterdam','NL','https://manhattancoffeeroasters.com','general_knowledge','medium','2026-05-31'),
 ('friedhats','Friedhats','Amsterdam','NL','https://friedhats.com','general_knowledge','medium','2026-05-31'),
 ('koppi','Koppi','Helsingborg','SE','https://koppi.se','general_knowledge','medium','2026-05-31');

