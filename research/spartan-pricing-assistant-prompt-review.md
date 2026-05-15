# Spartan Pricing Assistant — system-prompt review

> Cross-checked the system prompt against the actual `Spartan_Pricing_Reference.xlsx` workbook on 2026-05-12. Findings below are categorized by severity. The most consequential issue is workbook-internal (limb-as-tree threshold disagrees with itself across sheets), not a prompt bug.

---

## 1. WORKBOOK CONFLICTS WITH ITSELF — fix the workbook first

### Limb-as-Tree threshold: 6" or 8"? The workbook says both.

The canonical Variables sheet defines `Limb_As_Tree_Threshold = 6` and explicitly notes "Updated from 8" to 6"." But four other places in the workbook still use 8":

| Location | Says | Status |
|---|---|---|
| Variables sheet | **6"** | ✅ canonical |
| README instruction #21 | "Updated from 8" to 6"" | ✅ correct |
| README instruction #12 | "≥ 8 inches" | ❌ outdated |
| Rate Card "Trimming — Large Lead as Tree" | Min Units = 8, "≥ 8"" | ❌ outdated |
| Tree Removal Summary §3 | "(8")", header "8" threshold" | ❌ outdated |
| Tree Trimming Detailed §3 | "over 6 inches" | ✅ correct |
| Worked Example 8 | "14" union > 8" threshold" | ❌ outdated, but the example's math still produces correct quote |

**Impact:** The assistant will quote inconsistently depending on which sheet it consults first. An 8" lead is either standard trim work or a separate $80+/ft tree, depending on which sentence it reads.

**Fix:** Search-and-replace `8"` → `6"` and `8 inches` → `6 inches` in README #12, Rate Card row, Tree Removal Summary §3 and §4 table headers, and Worked Example 8's marginal annotation. Re-run the Worked Example 8 math (it should still produce $3,720 — only the explanatory note changes).

---

## 2. PROMPT HAS WRONG MATH

### The 32" stump worked example doesn't reconcile

The prompt's example states:

> QUOTE: ~$632 + topsoil/seed (~$80)
> Primary stump (32" diameter): $100 + $11 × (32 − 12) = $320
> Grinding removal (truck access OK): $320 (= grind price)
> If access is restricted, total becomes $952.

Per the workbook formulas applied correctly:

| Item | Per-workbook value | Prompt stated |
|---|---|---|
| Primary stump (32") | $320 | $320 ✓ |
| Grinding Removal, truck access | $320 | $320 ✓ |
| **Grinding subtotal, easy access** | **$640** | **$632** ❌ ($8 short) |
| Grinding Removal, no truck access | $640 | (doubles per rule) |
| **Total, restricted access (incl topsoil ~$80)** | **~$1,040** ($320 + $640 + $80) | **$952** ❌ |

The $632/$952 figures look like leftovers from a prior version of the formula. Two off-by-$8 errors are almost certainly a stale copy-paste. Replace with $640 and $1,040 (or $720 / $1,040 if topsoil is included on both sides).

### Topsoil estimate on a 32" stump

Per the Topsoil per Stump sheet logic:
- Hole diameter: 32" + 12" margin = 44"
- Hole area: π × (44/24)² = **10.56 sqft**
- Full backfill (6"): 10.56 × 0.5 ft = **5.28 cu ft = 8 bags = 0.20 cu yd**

The prompt says "7 bags or 0.21 cu yd, ~$80." Bags should be 8, not 7. $80 is reasonable using bagged retail ($10/bag). If a customer wants the Topsoil & Seeding line item, that has a 3-yard minimum at $500/yd = **$1,500 minimum** — single-stump residential jobs almost always use bagged. Flag this for the assistant.

---

## 3. PROMPT IS MISSING RULES THE WORKBOOK ESTABLISHES

The prompt under-specifies several rules the workbook is explicit about. Each of these can produce wrong quotes:

### a) Bucket Truck bundled-minimum rule (high impact)

Rate Card note on Bucket Truck: **"Minimum applies to all hourly items bundled with this item. If bucket truck rolls, every hourly line on the job carries a 2-hour minimum."** The prompt never mentions this. A bucket truck job priced for 1 hour will be underquoted by $375+ if the assistant doesn't apply the 2-hour minimum across Climber, Ground Worker, Chip Truck.

### b) Job multiplier order (you flagged this in the first review — now confirmed)

Job Multipliers sheet: **"apply the percentage-based multipliers (poison ivy, leave-all, no-small-cleanup) FIRST as a chained multiplication, THEN subtract the dollar discounts (leave-half-load, leave-full-load)."** The prompt says "apply in order" without specifying. Lock in the workbook's order.

### c) Hourly rates are nowhere in the prompt

The prompt tells the assistant to "calculate the hourly buildup" but never gives rates. They exist in the Rate Card:

- Ground Worker: $125/hr (1-hr min)
- Bucket Truck w/ Operator: $250/hr (2-hr min)
- Climber: $250/hr (1-hr min)
- Chip Truck w/ Operator: $250/hr (1-hr min)
- Equipment with Operator (skid steer, mini-ex): $250/hr (1-hr min)
- Logs (Haul-Away): $250/load (no hourly)
- 45 Ton Crane: $500/hr (4-hr min)
- Spider Lift: $750/rental
- Grapple Saw Truck: $2,500/day

Either drop these into the prompt or tell the assistant to consult the Rate Card every time.

### d) "Work portion" composition is ambiguous

Workbook Hazard Modifiers §3 is precise:
- **Work portion = Bucket Truck + Climber + Ground Worker + Chip Truck + Limb-as-tree floors + Tree removal floor**
- **Non-work portion = Logs (haul), Stump Grinding, Topsoil & Seed, materials, trip charges**

The prompt says "labor + equipment hours" and lists "haul" as part of hourly buildup. Per the workbook, **Logs (Haul-Away) is NOT in the work portion** for hazard purposes — it's billed straight at $250/load and the hazard multiplier doesn't touch it. Worked Example 9 confirms: $6,000 work × 2.0 = $12,000, then $250 logs is added flat.

Tighten the prompt: enumerate exactly what the hazard multiplier applies to.

### e) Priority Scheduling is missing entirely

Rate Card: **Priority Scheduling = 25% of subtotal, applied AFTER all line items are summed.** README #7 emphasizes this is NOT per-line-item. The prompt doesn't mention it. Add it as a final-step line item with a flag for staff to ask about.

### f) Whole categories of work missing

The prompt is tree-only. Workbook also covers:
- Planting (×3/×2.5/×2 multiples of plant cost based on tier)
- Land Clearing (Light/Dense Ground Cover, Light/Dense Brush, $1–$4/sqft)
- Mulching, Edging & Prep, Stone Install
- Forestry Mulching, Powerwashing, Polymeric Sand
- Yard Cleanup, PHC Cabling, PHC COBRA
- Topsoil delivered, Topsoil & Seeding (3-yard minimums on both)

If the assistant is intended to be a tree-only tool, say so explicitly in the prompt. If it's supposed to handle the whole Rate Card, add coverage for these.

### g) Tree Removal Summary sheet is flagged as outdated in the workbook itself

The Summary sheet header says: **"BRIEF SUMMARY only. For the FULL pricing rules, use the Tree Removal Detailed and Tree Trimming Detailed sheets."** And per the limb-as-tree issue above, this Summary sheet still uses the old 8" threshold. Tell the assistant to consult Detailed sheets, not the Summary.

---

## 4. PROMPT-WORKBOOK FRAMING MISMATCH

The prompt presents pricing as "calculate floors first, take max, then check hourly buildup." The workbook (README #11, Tree Removal Summary, all Worked Examples 6–11) frames it the opposite way: **build hourly buildup as the primary price, use floors as a sanity-check minimum**. Worked Example 6 explicitly states: "The floor is a sanity check but doesn't change the price."

This isn't a math error — `MAX(buildup, max_floor)` is the same either way — but it changes how the assistant reasons. Recommend rewording Step 3 to lead with the buildup ("calculate the hourly buildup of the crew + equipment for the estimated job duration, then compute each applicable floor, then quote `MAX(buildup, highest_floor)`").

---

## 5. PROMPT IS WEAKER THAN WORKBOOK ON SAFETY

Workbook Hazard Modifiers §6 says explicitly:

- **"If Spartan does not have an LCQ available, decline the job rather than reducing the multiplier to win it."**
- **"ALWAYS verify line type during the site visit, not by phone."**
- **"Photograph the pole and lines and include with the estimate."**
- **"Do NOT modify the multiplier downward to win the job."**

The prompt's escalation list mentions "high power line work" but doesn't carry this language. Quote the workbook directly.

---

## 6. PROMPT WORKFLOW GAPS

### a) Truck access for Grinding Removal

The workbook (README #10, Worked Example 4) treats this as a mandatory question for every stump grinding quote — the $2× modifier can swing a quote $500+. The prompt mentions "easy access" as an assumption in the worked example but doesn't include it in the Stump Grinding intake checklist. Add: "Can a truck drive up to within ~20 feet of the stump?"

### b) Root flare measurement

Workbook README #9 is emphatic: stumps must be measured **at the root flare** at ground level, NOT the cut surface. The prompt mentions this in Critical Rule #7 but should make it a required intake confirmation: "Confirm: diameter measured at root flare (widest point at ground level)?"

### c) Codominant leads — visual verification

Workbook Tree Removal Detailed §1 + README #24: "Codominant leads should each be visually inspected." Quotes shouldn't be given over the phone for codominant trees without photos.

---

## 7. THINGS THE PROMPT GETS RIGHT (keep these)

- The "floors compete, multipliers compose" framing is correct.
- "Take highest hazard, do not stack" matches the workbook.
- "Never invent a price, route to 585-501-6111" is the right escape hatch.
- The breakdown-with-assumptions output format is good.
- Stump grinding formulas (primary `MAX($100, $100 + $11 × (d−12))` and add-on `MAX($25, $5 × d)`) match the workbook exactly.
- DBH floor coefficients ($50/$100/$137.50 per inch) match.
- Tree removal floor coefficients ($10/$20/$30 per foot) match.
- Codominant multipliers (2.0× for 2 leads, up to 3.0× for 3+) match.
- Takedown tiers ($100/$150/$200/$300, $400 floor over 24" DBH) match.
- Trim minimums ($100/$150/$200/$300/$400 + working-height floors) match.

---

## 8. RANKED FIX LIST

Do these before deploying the assistant:

1. **Fix the workbook's 6"-vs-8" limb threshold inconsistency.** README #12, Rate Card row, Tree Removal Summary §3-4, Worked Example 8 annotation. The Variables sheet is canonical (6").
2. **Fix the 32" stump worked example** in the prompt: $640/$960 (or $720/$1,040 with topsoil), not $632/$952.
3. **Add the bucket-truck bundled-minimum rule** to the prompt (high underquote risk).
4. **Lock in the job multiplier order** in the prompt (% multipliers chained, then $ subtractions, never below minimum).
5. **Define "work portion" exactly** for hazard purposes — list the included line items and the excluded ones.
6. **Add hourly rates** to the prompt or instruct it to consult the Rate Card every time.
7. **Add Priority Scheduling** (25% on subtotal, post-sum) to the workflow.
8. **Strengthen high-power-line safety language** — quote the workbook ("decline the job").
9. **Add mandatory intake questions** for stump grinding (truck access, root flare confirmation) and tree removal (codominant verification, hazard category).
10. **Reframe Step 3** to lead with hourly buildup as the primary method, floors as sanity check (matches workbook).
11. **Decide scope**: tree-only or whole Rate Card? Add Planting/Land Clearing/Mulching/etc. coverage if intended, or explicitly disclaim if not.
12. **Tell the assistant to consult Tree Removal Detailed and Tree Trimming Detailed**, not the Summary sheet (which is flagged as outdated).

---

## 9. Verified parity against the workbook

These quotes from the prompt match the workbook line-for-line:

| Prompt claim | Workbook source | Match |
|---|---|---|
| Primary stump = MAX($100, $100 + $11×(d−12)) | Variables + Stump Grinding | ✅ |
| Add-on stump = MAX($25, $5×d) | Variables + Stump Grinding | ✅ |
| Height floors $10/$20/$30 per foot | Variables + Tree Removal Detailed | ✅ |
| DBH floors $50/$100/$137.50 per inch | Variables + Tree Removal Detailed | ✅ |
| Codominant multiplier 2.0×–3.0× | Variables + Tree Removal Detailed | ✅ |
| Loader minimum $750 flat | Variables | ✅ |
| Log load: $1,000 for 1, $2,000/load for 2+ | Variables | ✅ |
| Log truck disposal $500 per 60-yd load | Variables | ✅ |
| Cylinder formula π × (DBH/24)² × H / 27, ×1.3 packing | Variables + Tree Removal Detailed | ✅ |
| Trim minimums $100/$150/$200/$300/$400 | Variables + Trim Detailed | ✅ |
| Takedown tiers $100/$150/$200/$300, $400 over 24" | Variables + Takedowns | ✅ |
| Hazard multipliers 2.0× / 2.0× / 3.0× | Variables + Hazard Modifiers | ✅ |
| Poison ivy +50%, leave-all 25–75%, leave-logs -$150/-$300 | Variables + Job Multipliers | ✅ |
| No-small-cleanup -10% | Variables + Job Multipliers | ✅ |
| Take highest hazard, do not stack | Hazard Modifiers §2 | ✅ |
| Minimums inviolable after multipliers | Job Multipliers §2 | ✅ |
