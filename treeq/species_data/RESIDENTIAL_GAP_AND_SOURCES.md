# Residential-Yard Species Gap + Removal Volume Sources

## Why this exists
Every public city tree inventory we extracted is street + park trees. Peer-reviewed work confirms the bias: "the urban [public] environment contains significantly fewer tree species, lower total tree density, **no large conifers**, a narrower range of tree diameters, and a more park-like condition" than residential yards (ISA Arboriculture & Urban Forestry, "Residential Forest Structure in Urban and Suburban Environments"). For TreeQ — a *residential removal* app — this is the most important systematic gap to correct.

## Species systematically under-represented in city street tree inventories vs. residential yards

These are present at high frequency in residential yards but rarely in street-tree inventories (or capped due to overhead-utility clearance, narrow tree pits, or city planting policy). When ranking species for the app, the rule of thumb is to **boost these species 1-2 ranks above their inventory position** for residential users in the relevant region.

### Northeast & Mid-Atlantic
- **Eastern white pine** (large; not planted in tree pits; common in residential plantings as specimen and screen)
- **Norway spruce** (>50' specimens common in old residential lots, never on streets)
- **Blue spruce, Colorado** (residential specimen tree; rarely a street tree)
- **Eastern hemlock** (residential screen/specimen; HWA-affected)
- **Silver maple** (capped in cities post-1990; still everywhere in older yards)
- **Apple, pear, cherry, plum** (legacy fruit trees; never planted as street trees)
- **Black walnut, hickory** (large yard trees; allelopathy excludes from streets)
- **Bradford/Callery pear** (less in newer street plantings, still ubiquitous in 1990s subdivisions)

### Southeast (Piedmont, Coastal Plain, Florida)
- **Leyland cypress** (the dominant residential screen tree in the SE; almost never a street tree; Seiridium canker drives lots of removals)
- **Loblolly pine** (very common in SE yards; often removed for storm/structure)
- **Magnolia grandiflora** (Southern magnolia, large residential specimens)
- **Slash pine** (FL/GA yards)
- **Crape myrtle** (multi-stem ornamentals removed for size or "topping" damage)
- **Cherry laurel, holly** (hedge species)

### Gulf Coast / Texas
- **Live oak** (yard specimens larger than street equivalents)
- **Pecan** (universal in TX/LA/MS yards; rarely on streets)
- **Bald cypress** (residential specimens)
- **Chinese tallow** (invasive, removal-recommended; absent from street inventories)
- **Mesquite, hackberry** (TX yards)

### Midwest / Great Lakes / Plains
- **Silver maple** (the dominant 1950s-70s residential planting)
- **Cottonwood, willow** (large yard removals; not on streets due to size)
- **Black walnut, butternut** (legacy yard trees)
- **Apple, pear, cherry** (legacy orchards in suburban/exurban yards)
- **Norway spruce, blue spruce** (residential specimens)
- **Boxelder** (ubiquitous as volunteer; rarely on streets)
- **Catalpa, mulberry** (legacy yard trees, often removed for mess)

### Mountain West / Rockies
- **Blue spruce, Colorado** (the dominant residential conifer; needle-cast removals)
- **Aspen, quaking** (residential specimens; suckering issues)
- **Cottonwood** (large yard removals)
- **Apple, pear** (legacy orchards in CO/UT/ID)
- **Lilac (tree form)** (yard specimens)

### Pacific Northwest (Coastal)
- **Western red cedar** (large residential specimens; rare on streets; major removal class for proximity-to-house issues)
- **Douglas-fir** (specimen trees in PNW yards)
- **Bigleaf maple** (yard specimens)
- **Western hemlock** (yard plantings)
- **Apple, pear, cherry** (legacy orchards throughout PNW)
- **Cedar of Lebanon, Atlas cedar** (specimen trees)

### Desert Southwest / California
- **Eucalyptus** (many residential, fewer street; wildfire/limb-failure removals)
- **Olive** (residential mature olives; pollen-banned in some cities so removal incentivized)
- **Citrus** (residential standards; rarely on streets)
- **Pepper tree (California, Brazilian)** (residential specimens)
- **Bottlebrush, oleander (tree form)** (residential)
- **Pine, Aleppo / Italian stone pine** (residential specimens)

### Hawaii
- **Mango, avocado, lychee, citrus** (residential fruit trees)
- **Banyan, monkeypod** (large residential specimens)
- **Albizia** (#1 hazard removal — invasive, rapid growth, weak wood)
- **Strawberry guava** (invasive, residential overgrowth)

## Removal-volume data sources — what actually exists

Direct answer: **there is no comprehensive public dataset of residential tree removal volume by species in the US**. Below is what does exist, with assessment.

| Source | Coverage | Access | Useful for v1? |
|---|---|---|---|
| **TCIA member surveys** | Wage/benefits, accident, operating cost benchmarks. Species-specific removal volume not published. | Members-only; tcia.org/surveys | No — wrong data |
| **ISA Arboriculture & Urban Forestry journal** | Peer-reviewed studies; some city-specific i-Tree analyses with composition + removal projections | Mostly open access at auf.isa-arbor.com | Yes — for cited city studies |
| **State Extension after-storm reports** | Hurricane Helene (NC/SC/GA 2024-25), derecho events; species-by-damage breakdowns | Free PDFs from state forest services / Extension | Yes — best-available regional removal-volume signal |
| **Utility vegetation management reports** | Required under FERC/state PUCs for IOUs; species mix in clearance/removal | Patchwork; some published in 10-K filings, others FOIA-only | Marginal — biased toward right-of-way species |
| **i-Tree Eco / Streets project reports** | Per-city, sponsored studies. Includes mortality projections. | Free PDFs, but you need to find each one | Yes for major cities (NYC, Boston, etc.) |
| **Insurance industry storm-damage data** | Aggregated by state; species-level data rare | Mostly proprietary (Verisk, Munich Re); some state filings | No — usually aggregated, not species-specific |
| **Municipal removal logs** | Cities that publish work-order data (Boston BPRD, NYC Forestry) include removed-trees with species | Open data portals — same APIs we used for inventories, often a separate "removed" filter | YES — high-value follow-up. Boston's BPRD dataset already includes a status field that we could filter to "removed" |

### Recommended next data step
Boston's CKAN dataset has a status field — we can pull just the removed records and get a real removed-by-species ranking. Same for NYC (the spc_common field with status='Dead' or 'Removed'). That would be the most authoritative removal-volume data for any US city, and it's already in the APIs we're hitting. I can extract this on the next pass.

## How TreeQ should use all this

For v1 species rankings:
1. **Start with city inventory rank** (from `city_inventories.csv`)
2. **Boost residential-gap species 1-2 ranks** for species in the lists above per region
3. **Pin all `flag=Yes` species to top of "most-removed" sub-list** (from `removal_priority_top10.csv`)
4. **For users in regions without city data** (most TreeQ regions), fall back to the regional defaults Perplexity provided in section 3 of its first response, plus the gap-correction lists above
