# R9 — Genus-Tile Data Audit

> Produced 2026-05-10 overnight session #2, recommendations only — no implementation.

The picker auto-derives genus tiles from `SPECIES.group`. As of v1.9 the tiles broken out are: Maples, Ashes, Oaks (Red), Oaks (White), Pines, Spruces, Hemlock & Cedar, Walnuts & Hickories, Birches, Cherries & Plums, Sycamore, Beech, Tulip Tree, Elm. **"Other Hardwoods"** still lumps **12 species** (per `index.html:1628..1742`). Cameron asked which of those 12 should get their own tile.

Decision criteria (in order of weight):

1. **Service frequency in Cameron's home market** (Rochester NY = Lower Great Lakes–Hudson). The picker is for him first.
2. **Removal pressure** (`Yes`/`Maybe`/`No` flag from `removal_priority_top10.csv`). Pest/disease/structural drivers raise volume.
3. **Customer recognition.** When a customer calls and says "I have a [species]," can the operator find it in <2 seconds?
4. **Visual distinctiveness in the leaf decision tree.** Some species have leaves so unmistakable that ID-flow becomes instant once the species is its own tile.
5. **Cut-math distinctiveness.** Species using the generic-hardwood equation (`b0=−2.2118, b1=2.4133`) are not math-distinctive from each other; the picker decision is purely UX.

Not weighted: total city-inventory count alone. Cameron is a residential service, and per `RESIDENTIAL_GAP_AND_SOURCES.md` city street trees systematically under-represent yard species — so a low street-tree count doesn't mean low residential frequency.

---

## Recommendation matrix

| # | Species (TreeQ key) | Recommendation | Tile name | Reason |
|---|---|---|---|---|
| 1 | `basswood` (Basswood / American Linden = Tilia americana) | **OWN TILE** (combine w/ #2) | "Linden" | Combined Tilia presence in Rochester is **#3 inventory rank, 4.25%** (LINDEN - LITTLE LEAF, 2744 trees) + #22 (LINDEN - AMERICAN, 617). Boston #2 at 6.71%. Cosmopolitan in NE; even with `No` removal flag, customer-recognition is near-universal (people say "linden" or "basswood" by name). Leaf is heart-shaped/asymmetric, instant in ID flow. |
| 2 | `littleleaf_linden` (Tilia cordata) | **MERGE w/ #1** | "Linden" | Same genus, near-identical biomass coefficients, same leaf shape. Drill-down inside the Linden tile picks one or the other if it matters. |
| 3 | `cottonwood` (Populus deltoides) | **OWN TILE** (combine w/ #4) | "Cottonwood / Poplar" | Denver **Yes flag**, 1.02%: "Brittle, storm failure, aggressive roots." Residential-gap doc lists for Midwest/Mountain West/Plains. Large residential specimens (older Rochester yards). When they fail, they fail dramatically — so they pull the call. Distinctive deltoid leaves. |
| 4 | `poplar_aspen` (Populus spp., includes aspen) | **MERGE w/ #3** | "Cottonwood / Poplar" | Same genus *Populus*. Aspen suckering is a Mountain West concern, less so for Rochester, but field-management-wise it's the same dismantling profile. Don't fork the tile by trembling-vs-deltate — keep one Populus tile. |
| 5 | `ginkgo` (Ginkgo biloba) | **OWN TILE** | "Ginkgo" | Present in **7 cities** (NYC #9 3.22%, Boston #12, Sacramento, SF, Portland, Pittsburgh #9, Philadelphia #10). All `No` flag — but visual recognition is near-instant (fan leaves are unique among urban trees), and customer concerns (fruit-smell, sidewalk lift, female-tree removal) drive specific service calls. Picker UX argument > inventory-volume argument here. |
| 6 | `hackberry` (Celtis occidentalis) | **OWN TILE** | "Hackberry" | Rochester **#18 at 1.35%**, also Sacramento, Denver, Boston, DC. **Maybe flag** (storm failure, large size). Distinctive corky-ridged bark + nipplegall + witches' broom drive customer-named calls ("can you look at my hackberry?"). |
| 7 | `magnolia` (Magnolia spp.) | **STAYS in Other Hardwoods** | — | SE-dominant species; Atlanta and Sacramento data, low Rochester relevance. Star-magnolia ornamentals exist in NE yards but rarely a removal target. Revisit if Cameron expands to Cleveland/Pittsburgh markets where it's more frequent. |
| 8 | `catalpa` (Catalpa speciosa / bignonioides) | **STAYS in Other Hardwoods** | — | Denver `Maybe` (1.32%, "messy seed pods"). Residential-gap lists Midwest legacy. Low Rochester residential volume. Customer recognition is strong ("Indian bean tree, with the long pods") but service frequency doesn't justify a tile yet. |
| 9 | `mulberry` (Morus alba) | **STAYS in Other Hardwoods** | — | LA County #12 `Maybe` (2.53%, fruit nuisance), Pittsburgh #24 `Maybe`. Residential-gap: Midwest legacy yard removal-for-mess. Volume in Rochester is small. Generic biomass equation; nothing math-special. Keep in Other Hardwoods, promote if call volume warrants. |
| 10 | `willow` (Salix spp.) | **STAYS in Other Hardwoods** | — | Not in any city street-tree top-25 (capped on streets, large for residential). Residential-gap lists Midwest large-yard removals. In Rochester these exist but are infrequent enough that a dedicated tile would be sparsely used. Distinctive weeping habit means leaf-decision flow can still find them. |
| 11 | `chinese_chestnut` (Castanea mollissima) | **STAYS in Other Hardwoods** *(or audit for removal)* | — | Not in any city inventory. Niche — orchard / estate plantings. May not warrant being in the production SPECIES list at all; ask Cameron whether he ever services these. If yes, keep as-is in Other Hardwoods. If "once a year if that," consider dropping. |
| 12 | `horse_chestnut` (Aesculus hippocastanum / buckeyes) | **STAYS in Other Hardwoods** | — | Not in any city inventory. Occasional in old NE/MW yards. Bleeding-canker pressure is mostly UK; minimal US service driver. Distinctive palmate leaf and conkers do help ID, but volume too low for tile UX cost. |

---

## Tile changes proposed (net)

If Cameron adopts these recommendations, the picker grid grows from 14 to **18 tiles**:

| Action | Tile name | Source species |
|---|---|---|
| ADD | Linden | `basswood`, `littleleaf_linden` |
| ADD | Cottonwood / Poplar | `cottonwood`, `poplar_aspen` |
| ADD | Ginkgo | `ginkgo` |
| ADD | Hackberry | `hackberry` |
| KEEP | Other Hardwoods (now 6 species) | `magnolia`, `catalpa`, `mulberry`, `willow`, `chinese_chestnut`, `horse_chestnut` |

**Implementation hint (out of scope for this doc, kept for future ticket):** the change is one-line per species — flip `group: "Other Hardwoods"` → `group: "Linden"` (or whatever) on each affected `SPECIES` entry. The picker auto-derives tiles from `SPECIES.group`, so no UI code touches. Tile leaf SVG and tile order would still need illustrator delivery + manual tile-meta entry.

---

## Cross-checks against handoff text

- HANDOFF.md called out the 12 species explicitly: Magnolia, Catalpa, Ginkgo, Hackberry, Cottonwood, Poplar/Aspen, Willow, Mulberry, Basswood, Linden, Chinese Chestnut, Horse Chestnut. The actual `SPECIES` data in `index.html` matches this exactly (basswood + littleleaf_linden are the two "Tilia" entries; cottonwood + poplar_aspen are the two "Populus" entries).
- Per the handoff, this audit is meant as input for Cameron — not implementation. Recommendations only. No `index.html` was modified.
- Per CONTEXT.md "Known weak points" §3, all 12 of these species use the generic-hardwood biomass equation (`b0=−2.2118, b1=2.4133`). Promoting any of them to its own tile does **not** change cut math — only UX surfacing.

---

## Risks / edge cases

1. **The Tilia tile name is contested.** "Linden" (Boston/East Coast usage) vs "Basswood" (Midwest/forest-industry usage) — choose one display name + drop the other into the species name. Recommendation: tile name "Linden" because it's shorter; species names retain "Basswood / American Linden" wording.
2. **Cottonwood / Poplar** is a slightly imprecise tile name — "Populus" is the proper genus but unhelpful to customers. Alternative: just "Poplar." But cottonwood is the higher-call-volume member, so leading with it works.
3. **Ginkgo's male-vs-female distinction matters for fruit-smell calls.** A single tile is fine; the species-detail page should mention the male/female pricing distinction (female ginkgo + sex-confirmed = non-fruit only) once the data layer supports it.
4. **If the genus tile count grows past ~18**, the 4-column picker grid layout starts to feel busy on mobile. Either accept 5 rows of 4 or switch to a denser grid. Out of scope here, flag for design pass.
5. **Chinese Chestnut may be removable from production.** If Cameron has serviced ≤1 per year, drop from `SPECIES` entirely rather than carry a generic-equation entry. This requires Cameron's input.

---

## Open questions for Cameron

1. **"Linden" or "Basswood" for the tile name?**
2. **Combine cottonwood+poplar/aspen, or keep separate?** I recommend combine.
3. **Drop Chinese Chestnut entirely or retain as legacy?**
4. **Do you have an illustrator queue for the four new tile leaves (Linden, Populus, Ginkgo, Hackberry)?** If not, Other Hardwoods can host them all in their tile-detail view first; the genus-tile promotion can wait for art.
