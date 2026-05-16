// =============================================================================
// SPARTAN CUT ESTIMATOR — Species Database (server-only)
//
// IMPORTANT: This file lives under functions/lib/ which Cloudflare Pages does
// NOT route (only files exporting onRequest* handlers become routes). It is
// imported by the API endpoints but never sent to the browser. The biomass
// coefficients, moisture factors, brush handling profiles, foliage fractions,
// height curves, and crown curves below are calibrated values that represent
// the IP of this estimator. Do not move this file into /public/ or import it
// from /public/ HTML.
// =============================================================================

// =============================================================================
// CUT TIME RULES (v2.1)
//
// Brush is cut into 15-ft sections; the cut-point diameter determines time.
// Logs are cut into 8-ft sections at the same fixed times. Per-handling-profile
// brush times have been replaced with per-class times — handling profile is
// kept on each species (still useful as a label) but no longer drives time.
// =============================================================================

export const BRUSH_SEC_PER_CUT = {
  lt4:    20,   // <4 inch cut point
  '4to8': 30,
  '8to12': 60
};

export const LOG_SEC_PER_CUT = {
  '12to18': 120,  // 2 minutes
  '18to24': 180,  // 3 minutes
  '24plus': 240   // 4 minutes
};

// Absorption profiles — three patterns based on tree structure:
//
//   hardwood     — hierarchical branching. A 10" limb carries many smaller
//                  subbranches that come down with one cut. (Hardwoods.)
//   soft_branch  — "every branch cut whole at the trunk". Most conifers
//                  (pine, spruce, hemlock): one cut per primary branch and
//                  almost all smaller wood attached to that branch comes down
//                  with it.
//   lead_only    — cedars / arborvitae / redwoods: only the primary or
//                  secondary leads need cuts; the rest of the foliage and
//                  small branches comes off with the lead.
//
// Mass is still tracked (for chip volume etc.) — only the cut COUNT is reduced.
export const ABSORB_PROFILES = {
  hardwood:    { lt4: 0.65, '4to8': 0.50 },
  soft_branch: { lt4: 0.90, '4to8': 0.75 },
  lead_only:   { lt4: 0.97, '4to8': 0.92 }
};

export const SPECIES = {
  // ===== MAPLES =====
  silver_maple: {
    name: "Silver Maple", scientificName: "Acer saccharinum", group: "Maples",
    pickerCategory: "Maples",
    b0: -2.0470, b1: 2.3852, sg: 0.44,
    moisture: 1.85, brushFrac: 0.45, foliageFrac: 0.15,
    heightA: 100, heightB: 0.040,
    crownIntercept: 8, crownSlope: 2.20,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },
  red_maple: {
    name: "Red Maple", scientificName: "Acer rubrum", group: "Maples",
    pickerCategory: "Maples",
    b0: -2.0470, b1: 2.3852, sg: 0.49,
    moisture: 1.70, brushFrac: 0.40, foliageFrac: 0.13,
    heightA: 90, heightB: 0.040,
    crownIntercept: 6, crownSlope: 1.70,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  norway_maple: {
    name: "Norway Maple", scientificName: "Acer platanoides", group: "Maples",
    pickerCategory: "Maples",
    b0: -1.8011, b1: 2.3852, sg: 0.55,
    moisture: 1.65, brushFrac: 0.40, foliageFrac: 0.13,
    heightA: 80, heightB: 0.045,
    crownIntercept: 6, crownSlope: 1.60,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  sugar_maple: {
    name: "Sugar Maple", scientificName: "Acer saccharum", group: "Maples",
    pickerCategory: "Maples",
    b0: -1.8011, b1: 2.3852, sg: 0.56,
    moisture: 1.65, brushFrac: 0.38, foliageFrac: 0.12,
    heightA: 100, heightB: 0.035,
    crownIntercept: 6, crownSlope: 1.70,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  black_maple: {
    name: "Black Maple", scientificName: "Acer nigrum", group: "Maples",
    pickerCategory: "Maples",
    b0: -1.8011, b1: 2.3852, sg: 0.55,
    moisture: 1.65, brushFrac: 0.38, foliageFrac: 0.12,
    heightA: 95, heightB: 0.035,
    crownIntercept: 6, crownSlope: 1.65,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  freeman_maple: {
    name: "Freeman/Autumn Blaze Maple", scientificName: "Acer × freemanii", group: "Maples",
    pickerCategory: "Maples",
    b0: -2.0470, b1: 2.3852, sg: 0.48,
    moisture: 1.75, brushFrac: 0.42, foliageFrac: 0.14,
    heightA: 90, heightB: 0.040,
    crownIntercept: 6, crownSlope: 1.80,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  boxelder: {
    name: "Boxelder", scientificName: "Acer negundo", group: "Maples",
    pickerCategory: "Maples",
    b0: -2.0470, b1: 2.3852, sg: 0.42,
    moisture: 1.80, brushFrac: 0.50, foliageFrac: 0.14,
    heightA: 70, heightB: 0.045,
    crownIntercept: 5, crownSlope: 1.60,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },

  // ===== OAKS =====
  red_oak: {
    name: "Red Oak", scientificName: "Quercus rubra", group: "Oaks",
    pickerCategory: "Oaks",
    b0: -2.0705, b1: 2.4410, sg: 0.56,
    moisture: 1.80, brushFrac: 0.30, foliageFrac: 0.12,
    heightA: 120, heightB: 0.035,
    crownIntercept: 8, crownSlope: 2.00,
    brushHandling: 'wide', diamGroup: 'hardwood_heavy'
  },
  white_oak: {
    name: "White Oak", scientificName: "Quercus alba", group: "Oaks",
    pickerCategory: "Oaks",
    b0: -2.0705, b1: 2.4410, sg: 0.60,
    moisture: 1.78, brushFrac: 0.28, foliageFrac: 0.11,
    heightA: 110, heightB: 0.034,
    crownIntercept: 8, crownSlope: 2.10,
    brushHandling: 'wide', diamGroup: 'hardwood_heavy'
  },
  pin_oak: {
    name: "Pin Oak", scientificName: "Quercus palustris", group: "Oaks",
    pickerCategory: "Oaks",
    b0: -2.0705, b1: 2.4410, sg: 0.58,
    moisture: 1.78, brushFrac: 0.32, foliageFrac: 0.12,
    heightA: 105, heightB: 0.038,
    crownIntercept: 7, crownSlope: 1.85,
    brushHandling: 'wide', diamGroup: 'hardwood_heavy'
  },
  bur_oak: {
    name: "Bur Oak", scientificName: "Quercus macrocarpa", group: "Oaks",
    pickerCategory: "Oaks",
    b0: -2.0705, b1: 2.4410, sg: 0.58,
    moisture: 1.78, brushFrac: 0.28, foliageFrac: 0.11,
    heightA: 110, heightB: 0.034,
    crownIntercept: 8, crownSlope: 2.20,
    brushHandling: 'wide', diamGroup: 'hardwood_heavy'
  },
  swamp_white_oak: {
    name: "Swamp White Oak", scientificName: "Quercus bicolor", group: "Oaks",
    pickerCategory: "Oaks",
    b0: -2.0705, b1: 2.4410, sg: 0.56,
    moisture: 1.80, brushFrac: 0.30, foliageFrac: 0.12,
    heightA: 110, heightB: 0.035,
    crownIntercept: 8, crownSlope: 2.00,
    brushHandling: 'wide', diamGroup: 'hardwood_heavy'
  },

  // ===== ASHES =====
  white_ash: {
    name: "White Ash", scientificName: "Fraxinus americana", group: "Ashes",
    pickerCategory: "Ashes & locusts",
    b0: -1.8384, b1: 2.3524, sg: 0.55,
    moisture: 1.65, brushFrac: 0.38, foliageFrac: 0.12,
    heightA: 105, heightB: 0.035,
    crownIntercept: 6, crownSlope: 1.60,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },
  green_ash: {
    name: "Green Ash", scientificName: "Fraxinus pennsylvanica", group: "Ashes",
    pickerCategory: "Ashes & locusts",
    b0: -2.0314, b1: 2.3524, sg: 0.53,
    moisture: 1.70, brushFrac: 0.40, foliageFrac: 0.13,
    heightA: 90, heightB: 0.040,
    crownIntercept: 5, crownSlope: 1.50,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },
  black_ash: {
    name: "Black Ash", scientificName: "Fraxinus nigra", group: "Ashes",
    pickerCategory: "Ashes & locusts",
    b0: -2.0314, b1: 2.3524, sg: 0.45,
    moisture: 1.85, brushFrac: 0.42, foliageFrac: 0.13,
    heightA: 90, heightB: 0.040,
    crownIntercept: 5, crownSlope: 1.40,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },

  // ===== BIRCHES =====
  white_birch: {
    name: "White Birch (Paper)", scientificName: "Betula papyrifera", group: "Birches",
    pickerCategory: "Birches",
    b0: -2.5932, b1: 2.5349, sg: 0.48,
    moisture: 1.75, brushFrac: 0.45, foliageFrac: 0.13,
    heightA: 70, heightB: 0.040,
    crownIntercept: 4, crownSlope: 1.20,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },
  river_birch: {
    name: "River Birch", scientificName: "Betula nigra", group: "Birches",
    pickerCategory: "Birches",
    b0: -2.5932, b1: 2.5349, sg: 0.48,
    moisture: 1.80, brushFrac: 0.45, foliageFrac: 0.13,
    heightA: 80, heightB: 0.040,
    crownIntercept: 5, crownSlope: 1.50,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  yellow_birch: {
    name: "Yellow Birch", scientificName: "Betula alleghaniensis", group: "Birches",
    pickerCategory: "Birches",
    b0: -2.5932, b1: 2.5349, sg: 0.55,
    moisture: 1.70, brushFrac: 0.40, foliageFrac: 0.12,
    heightA: 85, heightB: 0.038,
    crownIntercept: 5, crownSlope: 1.50,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },
  gray_birch: {
    name: "Gray Birch", scientificName: "Betula populifolia", group: "Birches",
    pickerCategory: "Birches",
    b0: -2.5932, b1: 2.5349, sg: 0.45,
    moisture: 1.75, brushFrac: 0.45, foliageFrac: 0.13,
    heightA: 50, heightB: 0.045,
    crownIntercept: 3, crownSlope: 1.10,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },

  // ===== NUT TREES · walnuts, hickories, chestnuts (& buckeye) =====
  black_walnut: {
    name: "Black Walnut", scientificName: "Juglans nigra", group: "Walnuts & hickories",
    pickerCategory: "Nut trees",
    b0: -2.5095, b1: 2.5437, sg: 0.51,
    moisture: 1.65, brushFrac: 0.32, foliageFrac: 0.12,
    heightA: 100, heightB: 0.038,
    crownIntercept: 6, crownSlope: 1.80,
    brushHandling: 'wide', diamGroup: 'hardwood_heavy'
  },
  butternut: {
    name: "Butternut (White Walnut)", scientificName: "Juglans cinerea", group: "Walnuts & hickories",
    pickerCategory: "Nut trees",
    b0: -2.5095, b1: 2.5437, sg: 0.36,
    moisture: 1.85, brushFrac: 0.40, foliageFrac: 0.13,
    heightA: 75, heightB: 0.040,
    crownIntercept: 6, crownSlope: 1.70,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  shagbark_hickory: {
    name: "Shagbark Hickory", scientificName: "Carya ovata", group: "Walnuts & hickories",
    pickerCategory: "Nut trees",
    b0: -2.5095, b1: 2.5437, sg: 0.64,
    moisture: 1.60, brushFrac: 0.30, foliageFrac: 0.11,
    heightA: 95, heightB: 0.035,
    crownIntercept: 5, crownSlope: 1.40,
    brushHandling: 'upright', diamGroup: 'hardwood_heavy'
  },

  // ===== LOCUSTS =====
  black_locust: {
    name: "Black Locust", scientificName: "Robinia pseudoacacia", group: "Locusts",
    pickerCategory: "Ashes & locusts",
    b0: -2.5095, b1: 2.5437, sg: 0.66,
    moisture: 1.55, brushFrac: 0.30, foliageFrac: 0.10,
    heightA: 90, heightB: 0.040,
    crownIntercept: 5, crownSlope: 1.40,
    brushHandling: 'upright', diamGroup: 'hardwood_heavy'
  },
  honey_locust: {
    name: "Honey Locust", scientificName: "Gleditsia triacanthos", group: "Locusts",
    pickerCategory: "Ashes & locusts",
    b0: -2.5095, b1: 2.5437, sg: 0.60,
    moisture: 1.55, brushFrac: 0.35, foliageFrac: 0.10,
    heightA: 95, heightB: 0.038,
    crownIntercept: 6, crownSlope: 1.65,
    brushHandling: 'wide', diamGroup: 'hardwood_heavy'
  },

  // ===== CHERRIES =====
  black_cherry: {
    name: "Black Cherry", scientificName: "Prunus serotina", group: "Cherries & Plums",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.50,
    moisture: 1.70, brushFrac: 0.40, foliageFrac: 0.13,
    heightA: 90, heightB: 0.038,
    crownIntercept: 5, crownSlope: 1.40,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },
  choke_cherry: {
    name: "Choke Cherry", scientificName: "Prunus virginiana", group: "Cherries & Plums",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.50,
    moisture: 1.75, brushFrac: 0.50, foliageFrac: 0.14,
    heightA: 35, heightB: 0.050,
    crownIntercept: 4, crownSlope: 1.20,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  ornamental_cherry: {
    name: "Ornamental Cherry (Kwanzan/Yoshino)", scientificName: "Prunus serrulata", group: "Cherries & Plums",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.45,
    moisture: 1.75, brushFrac: 0.50, foliageFrac: 0.14,
    heightA: 30, heightB: 0.060,
    crownIntercept: 4, crownSlope: 1.30,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },

  // ===== PEARS / APPLES / ROSACEAE =====
  callery_pear: {
    name: "Bradford / Callery Pear", scientificName: "Pyrus calleryana", group: "Pears & Apples",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.50,
    moisture: 1.70, brushFrac: 0.45, foliageFrac: 0.14,
    heightA: 45, heightB: 0.055,
    crownIntercept: 4, crownSlope: 1.20,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  pear: {
    name: "Pear (fruit)", scientificName: "Pyrus communis", group: "Pears & Apples",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.55,
    moisture: 1.65, brushFrac: 0.50, foliageFrac: 0.14,
    heightA: 35, heightB: 0.055,
    crownIntercept: 4, crownSlope: 1.10,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  apple: {
    name: "Apple", scientificName: "Malus domestica", group: "Pears & Apples",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.55,
    moisture: 1.65, brushFrac: 0.55, foliageFrac: 0.15,
    heightA: 30, heightB: 0.060,
    crownIntercept: 4, crownSlope: 1.20,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },
  crabapple: {
    name: "Crabapple", scientificName: "Malus spp.", group: "Pears & Apples",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.50,
    moisture: 1.65, brushFrac: 0.55, foliageFrac: 0.15,
    heightA: 22, heightB: 0.060,
    crownIntercept: 4, crownSlope: 1.10,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },
  hawthorn: {
    name: "Hawthorn", scientificName: "Crataegus spp.", group: "Pears & Apples",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.55,
    moisture: 1.65, brushFrac: 0.55, foliageFrac: 0.14,
    heightA: 25, heightB: 0.060,
    crownIntercept: 3, crownSlope: 1.00,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },

  // ===== BROADLEAF · MORE KINDS — each subgroup has ≥3 species where possible =====
  american_elm: {
    name: "American Elm", scientificName: "Ulmus americana", group: "Elm, linden & hackberry",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.50,
    moisture: 1.75, brushFrac: 0.40, foliageFrac: 0.13,
    heightA: 110, heightB: 0.034,
    crownIntercept: 7, crownSlope: 1.90,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  basswood: {
    name: "Basswood / American Linden", scientificName: "Tilia americana", group: "Elm, linden & hackberry",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.4108, b1: 2.4177, sg: 0.37,
    moisture: 1.85, brushFrac: 0.42, foliageFrac: 0.14,
    heightA: 100, heightB: 0.035,
    crownIntercept: 6, crownSlope: 1.60,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },
  littleleaf_linden: {
    name: "Littleleaf Linden", scientificName: "Tilia cordata", group: "Elm, linden & hackberry",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.4108, b1: 2.4177, sg: 0.40,
    moisture: 1.80, brushFrac: 0.40, foliageFrac: 0.13,
    heightA: 75, heightB: 0.038,
    crownIntercept: 5, crownSlope: 1.40,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },
  sycamore: {
    name: "Sycamore", scientificName: "Platanus occidentalis", group: "Sycamore, tulip & mulberry",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.46,
    moisture: 1.80, brushFrac: 0.35, foliageFrac: 0.12,
    heightA: 120, heightB: 0.034,
    crownIntercept: 8, crownSlope: 2.10,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  tulip_poplar: {
    name: "Tulip Poplar / Yellow Poplar", scientificName: "Liriodendron tulipifera", group: "Sycamore, tulip & mulberry",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.40,
    moisture: 1.85, brushFrac: 0.32, foliageFrac: 0.11,
    heightA: 130, heightB: 0.030,
    crownIntercept: 5, crownSlope: 1.40,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },
  beech: {
    name: "American Beech", scientificName: "Fagus grandifolia", group: "Beech & ginkgo",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.0705, b1: 2.4410, sg: 0.64,
    moisture: 1.65, brushFrac: 0.32, foliageFrac: 0.12,
    heightA: 100, heightB: 0.034,
    crownIntercept: 6, crownSlope: 1.80,
    brushHandling: 'wide', diamGroup: 'hardwood_heavy'
  },
  // ===== SOFT HARDWOODS (Salicaceous / fast-grown) =====

  cottonwood: {
    name: "Cottonwood", scientificName: "Populus deltoides", group: "Willow · cottonwood · poplar",
    pickerCategory: "Soft hardwoods",
    b0: -2.2118, b1: 2.4133, sg: 0.37,
    moisture: 1.95, brushFrac: 0.40, foliageFrac: 0.13,
    heightA: 120, heightB: 0.034,
    crownIntercept: 7, crownSlope: 1.90,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  poplar_aspen: {
    name: "Poplar / Aspen", scientificName: "Populus spp.", group: "Willow · cottonwood · poplar",
    pickerCategory: "Soft hardwoods",
    b0: -2.2118, b1: 2.4133, sg: 0.38,
    moisture: 1.90, brushFrac: 0.42, foliageFrac: 0.13,
    heightA: 80, heightB: 0.040,
    crownIntercept: 4, crownSlope: 1.30,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },
  willow: {
    name: "Willow", scientificName: "Salix spp.", group: "Willow · cottonwood · poplar",
    pickerCategory: "Soft hardwoods",
    b0: -2.2118, b1: 2.4133, sg: 0.36,
    moisture: 2.00, brushFrac: 0.55, foliageFrac: 0.15,
    heightA: 70, heightB: 0.045,
    crownIntercept: 6, crownSlope: 1.80,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },
  mulberry: {
    name: "Mulberry", scientificName: "Morus spp.", group: "Sycamore, tulip & mulberry",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.59,
    moisture: 1.65, brushFrac: 0.50, foliageFrac: 0.14,
    heightA: 50, heightB: 0.050,
    crownIntercept: 5, crownSlope: 1.50,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },
  magnolia: {
    name: "Magnolia", scientificName: "Magnolia spp.", group: "Magnolia & catalpa",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.46,
    moisture: 1.75, brushFrac: 0.50, foliageFrac: 0.15,
    heightA: 40, heightB: 0.050,
    crownIntercept: 4, crownSlope: 1.40,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },
  catalpa: {
    name: "Catalpa", scientificName: "Catalpa spp.", group: "Magnolia & catalpa",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.41,
    moisture: 1.75, brushFrac: 0.40, foliageFrac: 0.14,
    heightA: 60, heightB: 0.045,
    crownIntercept: 5, crownSlope: 1.50,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  hackberry: {
    name: "Hackberry", scientificName: "Celtis occidentalis", group: "Elm, linden & hackberry",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.49,
    moisture: 1.75, brushFrac: 0.42, foliageFrac: 0.13,
    heightA: 80, heightB: 0.038,
    crownIntercept: 6, crownSlope: 1.60,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  ginkgo: {
    name: "Ginkgo", scientificName: "Ginkgo biloba", group: "Beech & ginkgo",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.45,
    moisture: 1.70, brushFrac: 0.35, foliageFrac: 0.13,
    heightA: 80, heightB: 0.034,
    crownIntercept: 4, crownSlope: 1.20,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },
  chinese_chestnut: {
    name: "Chinese Chestnut", scientificName: "Castanea mollissima", group: "Chestnuts & buckeye",
    pickerCategory: "Nut trees",
    b0: -2.0705, b1: 2.4410, sg: 0.48,
    moisture: 1.70, brushFrac: 0.40, foliageFrac: 0.13,
    heightA: 60, heightB: 0.040,
    crownIntercept: 6, crownSlope: 1.70,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  horse_chestnut: {
    name: "Horse Chestnut / Buckeye", scientificName: "Aesculus hippocastanum", group: "Chestnuts & buckeye",
    pickerCategory: "Nut trees",
    b0: -2.4108, b1: 2.4177, sg: 0.38,
    moisture: 1.80, brushFrac: 0.45, foliageFrac: 0.16,
    heightA: 80, heightB: 0.038,
    crownIntercept: 6, crownSlope: 1.70,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },

  // ===== CONIFERS =====
  white_pine: {
    name: "Eastern White Pine", scientificName: "Pinus strobus", group: "Pines",
    pickerCategory: "Conifers",
    b0: -2.6177, b1: 2.4638, sg: 0.34,
    moisture: 2.00, brushFrac: 0.60, foliageFrac: 0.25,
    heightA: 130, heightB: 0.030,
    crownIntercept: 5, crownSlope: 1.40,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'soft_branch'
  },
  red_pine: {
    name: "Red Pine", scientificName: "Pinus resinosa", group: "Pines",
    pickerCategory: "Conifers",
    b0: -3.0506, b1: 2.6465, sg: 0.41,
    moisture: 1.85, brushFrac: 0.50, foliageFrac: 0.20,
    heightA: 90, heightB: 0.035,
    crownIntercept: 4, crownSlope: 1.10,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'soft_branch'
  },
  scotch_pine: {
    name: "Scotch Pine", scientificName: "Pinus sylvestris", group: "Pines",
    pickerCategory: "Conifers",
    b0: -3.0506, b1: 2.6465, sg: 0.42,
    moisture: 1.85, brushFrac: 0.55, foliageFrac: 0.22,
    heightA: 75, heightB: 0.040,
    crownIntercept: 4, crownSlope: 1.20,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'soft_branch'
  },
  norway_spruce: {
    name: "Norway Spruce", scientificName: "Picea abies", group: "Spruce, hemlock & arborvitae",
    pickerCategory: "Conifers",
    b0: -2.1364, b1: 2.3233, sg: 0.37,
    moisture: 1.95, brushFrac: 0.62, foliageFrac: 0.30,
    heightA: 110, heightB: 0.035,
    crownIntercept: 4, crownSlope: 1.20,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'soft_branch'
  },
  white_spruce: {
    name: "White Spruce", scientificName: "Picea glauca", group: "Spruce, hemlock & arborvitae",
    pickerCategory: "Conifers",
    b0: -2.1364, b1: 2.3233, sg: 0.36,
    moisture: 1.95, brushFrac: 0.62, foliageFrac: 0.30,
    heightA: 90, heightB: 0.035,
    crownIntercept: 3, crownSlope: 1.00,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'soft_branch'
  },
  blue_spruce: {
    name: "Colorado Blue Spruce", scientificName: "Picea pungens", group: "Spruce, hemlock & arborvitae",
    pickerCategory: "Conifers",
    b0: -2.1364, b1: 2.3233, sg: 0.38,
    moisture: 1.90, brushFrac: 0.60, foliageFrac: 0.28,
    heightA: 70, heightB: 0.040,
    crownIntercept: 4, crownSlope: 1.10,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'soft_branch'
  },
  hemlock: {
    name: "Eastern Hemlock", scientificName: "Tsuga canadensis", group: "Spruce, hemlock & arborvitae",
    pickerCategory: "Conifers",
    b0: -2.3480, b1: 2.3876, sg: 0.40,
    moisture: 1.95, brushFrac: 0.55, foliageFrac: 0.28,
    heightA: 100, heightB: 0.032,
    crownIntercept: 5, crownSlope: 1.40,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'soft_branch'
  },
  arborvitae: {
    name: "Arborvitae / White Cedar", scientificName: "Thuja occidentalis", group: "Spruce, hemlock & arborvitae",
    pickerCategory: "Conifers",
    b0: -2.7765, b1: 2.4195, sg: 0.31,
    moisture: 2.00, brushFrac: 0.65, foliageFrac: 0.35,
    heightA: 50, heightB: 0.045,
    crownIntercept: 2, crownSlope: 0.70,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'lead_only'
  }
};

export const BRUSH_DIAM_DIST = {
  hardwood_heavy: { d_avg_lt4: 2.0, d_avg_4to8: 5.5, d_avg_8to12: 9.5,
                    frac_lt4: 0.35, frac_4to8: 0.30, frac_8to12: 0.35 },
  hardwood_normal: { d_avg_lt4: 2.0, d_avg_4to8: 5.5, d_avg_8to12: 9.5,
                     frac_lt4: 0.45, frac_4to8: 0.30, frac_8to12: 0.25 },
  conifer:        { d_avg_lt4: 1.5, d_avg_4to8: 5.0, d_avg_8to12: 9.0,
                    frac_lt4: 0.65, frac_4to8: 0.25, frac_8to12: 0.10 }
};

/**
 * Cascading picker: tray 1 = category, tray 2 = optgroup (+ species).
 * Subgroups favour ≥3 entries; “Nut trees”, “Soft hardwoods”, etc. encode intent.
 */
export const PICKER_CATEGORY_ORDER = [
  "Maples",
  "Oaks",
  "Soft hardwoods",
  "Ashes & locusts",
  "Birches",
  "Nut trees",
  "Fruit & flowering trees",
  "Broadleaf · more kinds",
  "Conifers",
];

/** Order of subgroup labels inside each picker category */
export const PICKER_GROUP_ORDER_BY_CATEGORY = {
  Maples: ["Maples"],
  Oaks: ["Oaks"],
  "Soft hardwoods": ["Willow · cottonwood · poplar"],
  "Ashes & locusts": ["Ashes", "Locusts"],
  Birches: ["Birches"],
  "Nut trees": ["Walnuts & hickories", "Chestnuts & buckeye"],
  "Fruit & flowering trees": ["Cherries & Plums", "Pears & Apples"],
  "Broadleaf · more kinds": [
    "Elm, linden & hackberry",
    "Sycamore, tulip & mulberry",
    "Magnolia & catalpa",
    "Beech & ginkgo",
  ],
  Conifers: ["Pines", "Spruce, hemlock & arborvitae"],
};

