# TreeQ Species Database — Extraction Summary
**Last updated:** 2026-05-09
**Method:** Direct API extraction from public city open-data portals (Socrata, ArcGIS, CKAN). All counts are real, not estimates.

## Coverage: 14 cities, 2.55M trees inventoried

| City | TreeQ region | Trees in inventory | Top species | Source |
|---|---|---:|---|---|
| New York City | NYC-Long Island Coastal | 652,168 | London planetree (13.34%) | NYC Socrata |
| Denver | Mountain West South | 368,678 | Green Ash (6.76%) — EAB | Colorado Socrata |
| Seattle | Pacific Northwest Coastal | 267,090 | Japanese Maple (3.15%) | SDOT ArcGIS |
| Portland OR | Pacific Northwest Coastal | 252,205 | Norway maple (7.20%) | portlandmaps.com |
| Washington DC | Mid-Atlantic Coastal Plain | 220,154 | Red maple (5.38%) | DCGIS ArcGIS |
| San Francisco | California North Coast & Bay | 195,359 | London Plane (6.07%) | DataSF ArcGIS |
| Philadelphia | Mid-Atlantic Piedmont | 151,713 | London Planetree (10.77%) | Philly Parks ArcGIS |
| Atlanta (Trees Atlanta) | Southeast Piedmont | 121,316 | Eastern redbud (4.21%) | Trees Atlanta ArcGIS |
| Sacramento | California Central Valley | 99,500 | London plane (13.35%) | Sacramento ArcGIS |
| Rochester NY | Lower Great Lakes-Hudson | 64,520 | Norway Maple (10.04%) | Rochester ArcGIS |
| Boston | New England Coastal & Piedmont | 52,511 | Honeylocust (12.43%) | Boston CKAN |
| Tempe AZ (Phoenix proxy) | Desert Southwest Low Desert | 49,307 | Brush Box (9.02%) | Tempe ArcGIS |
| Pittsburgh | Central Appalachians | 45,709 | Norway Maple (8.13%) | WPRDC CKAN |
| LA County Parks (LA proxy) | California South Coastal | 4,312 | Canary Island Pine | LA County ArcGIS |

**Cities confirmed unavailable:** Houston (Trees For Houston has no machine-readable species API), Honolulu (Smart Trees Pacific publishes canopy not species inventory), Chicago (no public city tree inventory found), Minneapolis (no public city tree inventory found via standard portals).

## Removed-trees data (rare and valuable)

Three cities expose removal-status data via API:

| City | Status field | Removed records | Top removed species (removal-rate %) |
|---|---|---:|---|
| Seattle | `CURRENT_STATUS = 'REMOVED'` | 55,335 | English Midland Hawthorn (33%), Blireiana Plum (36%), European White Birch (27%), Norway Maple (16.6%), Sweetgum (23%) |
| Atlanta | `Status = 'Dead'` (planted-and-tracked) | 16,834 | Eastern redbud (29% mortality), Flowering dogwood (43%), Blackgum (25%) — these are transplant losses |
| Denver | `condition = 'Dead'` | 7,183 | Siberian Elm (6.4%), Aspen, Honey Locust, Hackberry |
| NYC | `status = 'Dead' / 'Stump'` | 31,615 | UNUSABLE — species field is null on all dead/stump records |

Seattle's removal-rate data validates several of our removal-priority flags: the species we flagged as YES (Norway Maple, European White Birch, Sweetgum) actually have 16-27% measured removal rates in Seattle's data.

## Files in this folder

- `city_inventories.csv` — raw inventory, 350 rows across 14 cities
- `city_inventories_flagged.csv` — same + `removal_flag` (Yes/Maybe/No) and `removal_reason` columns
- `removal_priority_top10.csv` — per city, top-10 species ordered by removal urgency (Yes-flagged first, then Maybe, then No)
- `regional_inventories.csv` — 35 TreeQ regions; 10 of 35 have direct city data, 25 marked as gaps
- `removed_trees_by_species.csv` — actual removed-tree counts from Seattle/Denver/Atlanta APIs
- `master_species_list.csv` — 280 unique species across all cities, sorted by how many cities they appear in
- `EXTRACTION_SUMMARY.md` — this file
- `MAY_2026_PEST_PRESSURE_MATRIX.md` — current pest/disease pressure by region
- `RESIDENTIAL_GAP_AND_SOURCES.md` — species under-represented in street vs residential, plus removal-volume data sources

## Cross-city findings (the cosmopolitan species)

Top species by *number of cities they appear in* (rather than just total count). These are the species TreeQ should always know, regardless of region:

| Species | Cities | Total trees | Flag |
|---|---:|---:|---|
| Red maple | 6 | 41,879 | No |
| Honeylocust | 5 | 87,807 | Maybe |
| Norway maple | 5 | 63,237 | Yes |
| Japanese zelkova | 5 | 42,163 | No |
| Ginkgo | 5 | 30,958 | No |
| Sweetgum | 5 | 21,332 | Maybe |
| London planetree | 4 | 109,329 | Maybe |
| Callery pear | 3 | 70,112 | Yes |
| Pin oak | 3 | 55,655 | Maybe |
| Cherry | 3 | 38,997 | Maybe |

## Regional coverage status

Of 35 TreeQ regions Perplexity defined, **10 have direct city-derived data**:
1. NYC-Long Island Coastal (NYC)
2. New England Coastal & Piedmont (Boston)
3. Lower Great Lakes-Hudson (Rochester)
4. Mid-Atlantic Coastal Plain (DC)
5. Mid-Atlantic Piedmont (Philadelphia)
6. Central Appalachians (Pittsburgh)
7. Southeast Piedmont (Atlanta)
8. Mountain West South (Denver)
9. Pacific Northwest Coastal (Seattle + Portland)
10. California North Coast & Bay (SF)
11. California Central Valley (Sacramento)
12. California South Coastal (LA County Parks proxy)
13. Desert Southwest Low Desert (Tempe proxy for Phoenix)

**25 regions still have no city data** and need either:
- Additional city extractions (e.g., Florida, Texas, Gulf Coast, Mountain West North, Hawaii, Alaska)
- Synthesis from state Extension publications (handled qualitatively in `RESIDENTIAL_GAP_AND_SOURCES.md`)
