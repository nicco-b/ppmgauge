-- seed :: coarse-precision coordinate fill so EVERY producer appears on the map.
-- Precision is tracked in geo_precision so coarse points are never shown as precise:
--   point   = geocoded to an actual place (set elsewhere)
--   region  = the producer's linked region centroid
--   country = the country centroid (mean of that country's regions) + small jitter
-- Run AFTER all precise geocoding is applied (the point rows must already exist).

-- 1. Tag already-geocoded producers as precise points.
UPDATE ref_producers SET geo_precision='point'
 WHERE lat IS NOT NULL AND lat!=0 AND geo_precision IS NULL;

-- 2. Region-level: producers linked to a region but without their own coords.
UPDATE ref_producers SET
  lat=(SELECT lat FROM ref_regions WHERE id=ref_producers.region_id),
  lng=(SELECT lng FROM ref_regions WHERE id=ref_producers.region_id),
  geo_precision='region'
 WHERE (lat IS NULL OR lat=0) AND region_id IS NOT NULL
   AND EXISTS (SELECT 1 FROM ref_regions r WHERE r.id=ref_producers.region_id AND r.lat IS NOT NULL);

-- 3. Country-level: everyone else with a country that has regions on record.
--    Centroid = mean of that country's region coords; jitter ±1.2° so they form a
--    cloud over the country instead of an exact invisible stack. RANDOM() is fixed at write time.
UPDATE ref_producers SET
  lat=(SELECT AVG(lat) FROM ref_regions WHERE country_code=ref_producers.country_code AND lat IS NOT NULL) + (ABS(RANDOM())%2400-1200)/1000.0,
  lng=(SELECT AVG(lng) FROM ref_regions WHERE country_code=ref_producers.country_code AND lng IS NOT NULL) + (ABS(RANDOM())%2400-1200)/1000.0,
  geo_precision='country'
 WHERE (lat IS NULL OR lat=0) AND country_code IS NOT NULL
   AND EXISTS (SELECT 1 FROM ref_regions r WHERE r.country_code=ref_producers.country_code AND r.lat IS NOT NULL);

-- 4. Countries with no regions on record: hardcoded (coffee-region-biased) centroids + jitter.
UPDATE ref_producers SET lat=-2.0+(ABS(RANDOM())%1200-600)/1000.0, lng=29.7+(ABS(RANDOM())%1200-600)/1000.0, geo_precision='country' WHERE lat IS NULL AND country_code='RW';
UPDATE ref_producers SET lat=-3.2+(ABS(RANDOM())%1200-600)/1000.0, lng=29.9+(ABS(RANDOM())%1200-600)/1000.0, geo_precision='country' WHERE lat IS NULL AND country_code='BI';
UPDATE ref_producers SET lat=23.6+(ABS(RANDOM())%1200-600)/1000.0, lng=120.8+(ABS(RANDOM())%1200-600)/1000.0, geo_precision='country' WHERE lat IS NULL AND country_code='TW';
UPDATE ref_producers SET lat=18.8+(ABS(RANDOM())%1200-600)/1000.0, lng=99.0+(ABS(RANDOM())%1200-600)/1000.0, geo_precision='country' WHERE lat IS NULL AND country_code='TH';
UPDATE ref_producers SET lat=19.7+(ABS(RANDOM())%1200-600)/1000.0, lng=-155.5+(ABS(RANDOM())%1200-600)/1000.0, geo_precision='country' WHERE lat IS NULL AND country_code='US';
UPDATE ref_producers SET lat=19.0+(ABS(RANDOM())%1200-600)/1000.0, lng=-72.3+(ABS(RANDOM())%1200-600)/1000.0, geo_precision='country' WHERE lat IS NULL AND country_code='HT';
UPDATE ref_producers SET lat=21.0+(ABS(RANDOM())%1200-600)/1000.0, lng=96.5+(ABS(RANDOM())%1200-600)/1000.0, geo_precision='country' WHERE lat IS NULL AND country_code='MM';
UPDATE ref_producers SET lat=16.4+(ABS(RANDOM())%1200-600)/1000.0, lng=120.8+(ABS(RANDOM())%1200-600)/1000.0, geo_precision='country' WHERE lat IS NULL AND country_code='PH';
UPDATE ref_producers SET lat=15.2+(ABS(RANDOM())%1200-600)/1000.0, lng=106.1+(ABS(RANDOM())%1200-600)/1000.0, geo_precision='country' WHERE lat IS NULL AND country_code='LA';
UPDATE ref_producers SET lat=7.5+(ABS(RANDOM())%1200-600)/1000.0, lng=-5.5+(ABS(RANDOM())%1200-600)/1000.0, geo_precision='country' WHERE lat IS NULL AND country_code='CI';
UPDATE ref_producers SET lat=26.5+(ABS(RANDOM())%1200-600)/1000.0, lng=128.0+(ABS(RANDOM())%1200-600)/1000.0, geo_precision='country' WHERE lat IS NULL AND country_code='JP';
UPDATE ref_producers SET lat=-20.3+(ABS(RANDOM())%1200-600)/1000.0, lng=57.5+(ABS(RANDOM())%1200-600)/1000.0, geo_precision='country' WHERE lat IS NULL AND country_code='MU';
UPDATE ref_producers SET lat=-12.0+(ABS(RANDOM())%1200-600)/1000.0, lng=30.0+(ABS(RANDOM())%1200-600)/1000.0, geo_precision='country' WHERE lat IS NULL AND country_code='ZM';
