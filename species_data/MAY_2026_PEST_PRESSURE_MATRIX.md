# May 2026 Pest & Disease Pressure Matrix

Drives the `removal_priority_top10.csv` flags. Sources are May 2026 research from USDA APHIS, state Extensions, and arborist trade publications.

## Active drivers by region

| Driver | Status May 2026 | Affected regions | Species impact | Removal-flag treatment |
|---|---|---|---|---|
| **Emerald Ash Borer (EAB)** | 36 US states (USDA APHIS Jan 2026 map). Eastern saturation in MI/OH/IN/IL; still spreading west and into Pacific NW. Oregon now affected. | All except South Florida, parts of Texas, Hawaii | All ash (Fraxinus): green, white, black, blue, Modesto, Arizona, Shamel | YES universally |
| **Beech Leaf Disease (BLD)** | Detected in 13 states + Ontario as of Dec 2024; spreading rapidly. Now in all of Maine. Saplings die in 5 years. | Northeast: OH, CT, DE, ME, MA, MI, NH, NY, NJ, PA, RI, VA, WV | American beech (Fagus grandifolia) | YES in affected states; MAYBE in adjacent |
| **Spotted Lanternfly + Tree of Heaven** | OH issued statewide quarantine Feb 17, 2026 (expanded from 18 counties). PA: 56 of 67 counties. NJ: all 21 counties. | Mid-Atlantic, OH, expanding | Tree of heaven (Ailanthus); secondary impact on dozens of host trees | YES for tree of heaven everywhere |
| **Bradford/Callery Pear bans** | Banned in OH, SC, PA, NJ (NJ phased to 2030). Bounty/exchange programs in NC, IN (multiple counties), VA. Indiana statewide ban moving in 2026. | Continental US (active in Midwest, Mid-Atlantic, Southeast) | Pyrus calleryana (Bradford, Cleveland Select, Aristocrat, etc.) | YES universally |
| **Oak Wilt** | TX A&M increased cost-share funding 2026 due to surge from wet 2026 spring. Major in IL, IA, MI, MN, TX, WI. | Central Texas (acute), Upper Midwest | Red oaks (Q. rubra, Q. shumardii, Q. texana, Spanish oak); white oaks lower risk | YES in TX Central / Hill Country and Upper Midwest; MAYBE elsewhere |
| **Sudden Oak Death (SOD)** | Confirmed in 16 CA counties + Curry Co OR. >1M oak/tanoak killed cumulatively. | California North Coast & Bay, Pacific Northwest Coastal (southern OR) | Coast live oak, tanoak, black oak, some rhododendron carrier hosts | YES in CA coastal; MAYBE in PNW Coastal (Curry only) |
| **Hemlock Woolly Adelgid (HWA)** | Active mortality eastern US; pushing north into New England | Northeast, Mid-Atlantic, Central Appalachians | Eastern hemlock (Tsuga canadensis), Carolina hemlock | YES |
| **Bronze Birch Borer** | Active in stress sites; very high mortality on European white birch in warm zones | All temperate zones; especially heat-stressed urban sites | European white birch (Betula pendula, very high), paper birch (high), river birch (lower) | YES on B. pendula and B. papyrifera; MAYBE on river birch |
| **Norway Maple invasive removals** | Recommended-removal in NE/PNW; structural failure (weak unions, included bark) drives independent residential removals | Northeast, Upper Midwest, Pacific NW | Acer platanoides + cultivars (Crimson King, Schwedler, etc.) | YES |
| **Silver Maple structural** | Not pest-driven; weak wood + storm-prone + surface-root damage drive frequent residential removals nationally | Continental US | Acer saccharinum | YES |
| **Siberian Elm invasive** | Brittle wood, short-lived, invasive on Plains/Mountain West | Great Plains, Mountain West, Desert Southwest | Ulmus pumila | YES |
| **Blue Spruce decline** | Needle-cast complex (Rhizosphaera + Stigmina) epidemic in Mountain West and Plains; widespread mortality | Mountain West, Great Plains, Upper Midwest | Picea pungens (Colorado blue spruce) | YES |
| **Aleppo / Austrian Pine decline** | Diplodia tip blight + heat stress + beetle pressure | Aleppo: Desert SW. Austrian: Plains, Mtn West | Pinus halepensis, Pinus nigra | YES |
| **Eucalyptus wildfire/limb failure** | CA wildfire risk + sudden limb drop drive removal | California regions | All Eucalyptus species | YES |
| **Albizia hazard tree** | #1 hazard removal priority in HI (rapid growth, weak wood, falls onto homes) | Hawaii Tropical Urban | Falcataria moluccana | YES |
| **Laurel Wilt** | Killed redbays & sassafras in SE; spreading | Southeast Coastal Plain, Florida Peninsula, Gulf Coast | Redbay, sassafras, avocado | YES in affected areas |

## How this maps to the dataset

Each species in `city_inventories_flagged.csv` and `removal_priority_top10.csv` has a `flag` column with one of:
- **Yes** = active acute removal driver (pest, disease, ban, structural)
- **Maybe** = elevated removal frequency due to size, lifespan, anthracnose, or location-dependent risk
- **No** = standing inventory; no current acute driver. Some of these may still be removed for incidental reasons (construction, landscape preferences) but are not removal-priority for app ordering.

## Reading the Rochester top-10 (your home market)

8 of the 10 highest-priority removals in Rochester are **YES-flagged**: Norway Maple variants (4 of those), Green Ash (EAB), Callery Pear, Silver Maple. This matches your CLAUDE.md memory of "Ashes > Maples > Conifers" being the most-removed categories in your service area — except the data shows Maples > Ashes by raw inventory count, with Conifers further down. Your memory describes removal frequency; the inventory shows standing population. Both are useful but they're measuring different things.

## Sources

- USDA APHIS EAB Map (Jan 13, 2026 update)
- Maine DACF / NYSDEC / Mass.gov beech leaf disease updates
- OH ODA spotted lanternfly statewide quarantine (Feb 17, 2026)
- Indiana / Ohio / NJ / SC / PA Bradford pear bans
- TX A&M Forest Service oak wilt cost-share announcement (2026)
- UC IPM Sudden Oak Death program
- US Forest Service beech leaf disease research (2026)
