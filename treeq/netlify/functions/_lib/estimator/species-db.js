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
  japanese_maple: {
    name: "Japanese Maple", scientificName: "Acer palmatum", group: "Maples",
    pickerCategory: "Specialty ornamentals",
    b0: -2.0470, b1: 2.3852, sg: 0.50,
    moisture: 1.70, brushFrac: 0.50, foliageFrac: 0.16,
    heightA: 22, heightB: 0.065,
    crownIntercept: 4, crownSlope: 1.50,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },
  paperbark_maple: {
    name: "Paperbark Maple", scientificName: "Acer griseum", group: "Maples",
    pickerCategory: "Specialty ornamentals",
    b0: -2.0470, b1: 2.3852, sg: 0.52,
    moisture: 1.70, brushFrac: 0.45, foliageFrac: 0.14,
    heightA: 28, heightB: 0.060,
    crownIntercept: 4, crownSlope: 1.40,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
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
  scarlet_oak: {
    name: "Scarlet Oak", scientificName: "Quercus coccinea", group: "Oaks",
    pickerCategory: "Oaks",
    b0: -2.0705, b1: 2.4410, sg: 0.57,
    moisture: 1.78, brushFrac: 0.30, foliageFrac: 0.12,
    heightA: 110, heightB: 0.036,
    crownIntercept: 8, crownSlope: 2.00,
    brushHandling: 'wide', diamGroup: 'hardwood_heavy'
  },
  black_oak: {
    name: "Black Oak", scientificName: "Quercus velutina", group: "Oaks",
    pickerCategory: "Oaks",
    b0: -2.0705, b1: 2.4410, sg: 0.57,
    moisture: 1.78, brushFrac: 0.30, foliageFrac: 0.12,
    heightA: 115, heightB: 0.035,
    crownIntercept: 8, crownSlope: 2.00,
    brushHandling: 'wide', diamGroup: 'hardwood_heavy'
  },
  chestnut_oak: {
    name: "Chestnut Oak", scientificName: "Quercus montana", group: "Oaks",
    pickerCategory: "Oaks",
    b0: -2.0705, b1: 2.4410, sg: 0.57,
    moisture: 1.78, brushFrac: 0.29, foliageFrac: 0.11,
    heightA: 100, heightB: 0.035,
    crownIntercept: 7, crownSlope: 1.90,
    brushHandling: 'wide', diamGroup: 'hardwood_heavy'
  },
  willow_oak: {
    name: "Willow Oak", scientificName: "Quercus phellos", group: "Oaks",
    pickerCategory: "Oaks",
    b0: -2.0705, b1: 2.4410, sg: 0.55,
    moisture: 1.80, brushFrac: 0.32, foliageFrac: 0.12,
    heightA: 90, heightB: 0.038,
    crownIntercept: 7, crownSlope: 1.80,
    brushHandling: 'wide', diamGroup: 'hardwood_heavy'
  },
  live_oak: {
    name: "Live Oak", scientificName: "Quercus virginiana", group: "Oaks",
    pickerCategory: "Southern & western",
    b0: -2.0705, b1: 2.4410, sg: 0.80,
    moisture: 1.55, brushFrac: 0.28, foliageFrac: 0.10,
    heightA: 55, heightB: 0.042,
    crownIntercept: 10, crownSlope: 3.00,
    brushHandling: 'wide', diamGroup: 'hardwood_heavy'
  },
  coast_live_oak: {
    name: "Coast Live Oak", scientificName: "Quercus agrifolia", group: "Oaks",
    pickerCategory: "Southern & western",
    b0: -2.0705, b1: 2.4410, sg: 0.75,
    moisture: 1.58, brushFrac: 0.28, foliageFrac: 0.10,
    heightA: 50, heightB: 0.042,
    crownIntercept: 9, crownSlope: 2.80,
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
  european_birch: {
    name: "European White Birch", scientificName: "Betula pendula", group: "Birches",
    pickerCategory: "Birches",
    b0: -2.5932, b1: 2.5349, sg: 0.51,
    moisture: 1.72, brushFrac: 0.44, foliageFrac: 0.13,
    heightA: 65, heightB: 0.042,
    crownIntercept: 4, crownSlope: 1.20,
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
  english_walnut: {
    name: "English Walnut", scientificName: "Juglans regia", group: "Walnuts & hickories",
    pickerCategory: "Nut trees",
    b0: -2.5095, b1: 2.5437, sg: 0.47,
    moisture: 1.70, brushFrac: 0.35, foliageFrac: 0.12,
    heightA: 60, heightB: 0.040,
    crownIntercept: 6, crownSlope: 1.80,
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
  pecan: {
    name: "Pecan", scientificName: "Carya illinoinensis", group: "Walnuts & hickories",
    pickerCategory: "Nut trees",
    b0: -2.5095, b1: 2.5437, sg: 0.60,
    moisture: 1.60, brushFrac: 0.30, foliageFrac: 0.11,
    heightA: 100, heightB: 0.035,
    crownIntercept: 7, crownSlope: 1.90,
    brushHandling: 'wide', diamGroup: 'hardwood_heavy'
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
  hazelnut: {
    name: "Hazelnut / Filbert", scientificName: "Corylus avellana", group: "Chestnuts & buckeye",
    pickerCategory: "Nut trees",
    b0: -2.5095, b1: 2.5437, sg: 0.55,
    moisture: 1.65, brushFrac: 0.55, foliageFrac: 0.14,
    heightA: 18, heightB: 0.070,
    crownIntercept: 3, crownSlope: 1.20,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },
  pistachio: {
    name: "Pistachio", scientificName: "Pistacia vera", group: "Chestnuts & buckeye",
    pickerCategory: "Nut trees",
    b0: -2.5095, b1: 2.5437, sg: 0.60,
    moisture: 1.55, brushFrac: 0.40, foliageFrac: 0.12,
    heightA: 30, heightB: 0.055,
    crownIntercept: 5, crownSlope: 1.50,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
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
  thornless_honey_locust: {
    name: "Thornless Honey Locust", scientificName: "Gleditsia triacanthos var. inermis", group: "Locusts",
    pickerCategory: "Ashes & locusts",
    b0: -2.5095, b1: 2.5437, sg: 0.60,
    moisture: 1.55, brushFrac: 0.35, foliageFrac: 0.10,
    heightA: 90, heightB: 0.038,
    crownIntercept: 6, crownSlope: 1.65,
    brushHandling: 'wide', diamGroup: 'hardwood_heavy'
  },

  // ===== CHERRIES / ORNAMENTAL PRUNUS =====
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
  weeping_cherry: {
    name: "Weeping Cherry", scientificName: "Prunus pendula", group: "Cherries & Plums",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.47,
    moisture: 1.75, brushFrac: 0.50, foliageFrac: 0.14,
    heightA: 25, heightB: 0.065,
    crownIntercept: 4, crownSlope: 1.40,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  yoshino_cherry: {
    name: "Yoshino Cherry", scientificName: "Prunus × yedoensis", group: "Cherries & Plums",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.47,
    moisture: 1.75, brushFrac: 0.48, foliageFrac: 0.14,
    heightA: 40, heightB: 0.055,
    crownIntercept: 5, crownSlope: 1.40,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  peach: {
    name: "Peach / Nectarine", scientificName: "Prunus persica", group: "Cherries & Plums",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.49,
    moisture: 1.70, brushFrac: 0.55, foliageFrac: 0.15,
    heightA: 22, heightB: 0.065,
    crownIntercept: 4, crownSlope: 1.20,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },
  sweet_cherry: {
    name: "Sweet Cherry", scientificName: "Prunus avium", group: "Cherries & Plums",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.50,
    moisture: 1.70, brushFrac: 0.50, foliageFrac: 0.14,
    heightA: 40, heightB: 0.050,
    crownIntercept: 5, crownSlope: 1.40,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  sour_cherry: {
    name: "Sour Cherry", scientificName: "Prunus cerasus", group: "Cherries & Plums",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.50,
    moisture: 1.72, brushFrac: 0.52, foliageFrac: 0.14,
    heightA: 22, heightB: 0.065,
    crownIntercept: 4, crownSlope: 1.20,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  plum: {
    name: "European Plum", scientificName: "Prunus domestica", group: "Cherries & Plums",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.50,
    moisture: 1.70, brushFrac: 0.52, foliageFrac: 0.14,
    heightA: 18, heightB: 0.068,
    crownIntercept: 4, crownSlope: 1.10,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  apricot: {
    name: "Apricot", scientificName: "Prunus armeniaca", group: "Cherries & Plums",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.52,
    moisture: 1.68, brushFrac: 0.52, foliageFrac: 0.14,
    heightA: 18, heightB: 0.068,
    crownIntercept: 4, crownSlope: 1.20,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },
  almond: {
    name: "Almond", scientificName: "Prunus dulcis", group: "Cherries & Plums",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.45,
    moisture: 1.65, brushFrac: 0.50, foliageFrac: 0.13,
    heightA: 22, heightB: 0.065,
    crownIntercept: 4, crownSlope: 1.20,
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
  asian_pear: {
    name: "Asian Pear", scientificName: "Pyrus pyrifolia", group: "Pears & Apples",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.55,
    moisture: 1.65, brushFrac: 0.50, foliageFrac: 0.14,
    heightA: 30, heightB: 0.058,
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
  fig: {
    name: "Fig", scientificName: "Ficus carica", group: "Pears & Apples",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.35,
    moisture: 1.90, brushFrac: 0.60, foliageFrac: 0.20,
    heightA: 20, heightB: 0.070,
    crownIntercept: 4, crownSlope: 1.40,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },
  pawpaw: {
    name: "Pawpaw", scientificName: "Asimina triloba", group: "Pears & Apples",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.38,
    moisture: 1.85, brushFrac: 0.55, foliageFrac: 0.16,
    heightA: 25, heightB: 0.062,
    crownIntercept: 4, crownSlope: 1.20,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },
  persimmon: {
    name: "Persimmon", scientificName: "Diospyros kaki", group: "Pears & Apples",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.58,
    moisture: 1.65, brushFrac: 0.48, foliageFrac: 0.14,
    heightA: 35, heightB: 0.055,
    crownIntercept: 5, crownSlope: 1.40,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  quince: {
    name: "Quince", scientificName: "Cydonia oblonga", group: "Pears & Apples",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.55,
    moisture: 1.68, brushFrac: 0.55, foliageFrac: 0.14,
    heightA: 18, heightB: 0.070,
    crownIntercept: 4, crownSlope: 1.10,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },
  flowering_dogwood: {
    name: "Flowering Dogwood", scientificName: "Cornus florida", group: "Cherries & Plums",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.51,
    moisture: 1.72, brushFrac: 0.55, foliageFrac: 0.16,
    heightA: 28, heightB: 0.060,
    crownIntercept: 5, crownSlope: 1.50,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },
  kousa_dogwood: {
    name: "Kousa Dogwood", scientificName: "Cornus kousa", group: "Cherries & Plums",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.51,
    moisture: 1.72, brushFrac: 0.55, foliageFrac: 0.16,
    heightA: 25, heightB: 0.062,
    crownIntercept: 5, crownSlope: 1.50,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },
  eastern_redbud: {
    name: "Eastern Redbud", scientificName: "Cercis canadensis", group: "Cherries & Plums",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.42,
    moisture: 1.80, brushFrac: 0.52, foliageFrac: 0.15,
    heightA: 30, heightB: 0.058,
    crownIntercept: 5, crownSlope: 1.50,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },
  serviceberry: {
    name: "Serviceberry / Juneberry", scientificName: "Amelanchier spp.", group: "Pears & Apples",
    pickerCategory: "Fruit & flowering trees",
    b0: -2.2118, b1: 2.4133, sg: 0.47,
    moisture: 1.75, brushFrac: 0.55, foliageFrac: 0.14,
    heightA: 22, heightB: 0.065,
    crownIntercept: 4, crownSlope: 1.30,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },

  // ===== BROADLEAF · MORE KINDS =====
  american_elm: {
    name: "American Elm", scientificName: "Ulmus americana", group: "Elm, linden & hackberry",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.50,
    moisture: 1.75, brushFrac: 0.40, foliageFrac: 0.13,
    heightA: 110, heightB: 0.034,
    crownIntercept: 7, crownSlope: 1.90,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  slippery_elm: {
    name: "Slippery Elm", scientificName: "Ulmus rubra", group: "Elm, linden & hackberry",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.48,
    moisture: 1.80, brushFrac: 0.40, foliageFrac: 0.13,
    heightA: 85, heightB: 0.036,
    crownIntercept: 7, crownSlope: 1.80,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  siberian_elm: {
    name: "Siberian Elm", scientificName: "Ulmus pumila", group: "Elm, linden & hackberry",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.49,
    moisture: 1.78, brushFrac: 0.42, foliageFrac: 0.13,
    heightA: 70, heightB: 0.040,
    crownIntercept: 6, crownSlope: 1.60,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  lacebark_elm: {
    name: "Lacebark / Chinese Elm", scientificName: "Ulmus parvifolia", group: "Elm, linden & hackberry",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.51,
    moisture: 1.75, brushFrac: 0.40, foliageFrac: 0.13,
    heightA: 65, heightB: 0.040,
    crownIntercept: 6, crownSlope: 1.60,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  zelkova: {
    name: "Japanese Zelkova", scientificName: "Zelkova serrata", group: "Elm, linden & hackberry",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.52,
    moisture: 1.72, brushFrac: 0.38, foliageFrac: 0.12,
    heightA: 80, heightB: 0.038,
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
  silver_linden: {
    name: "Silver Linden", scientificName: "Tilia tomentosa", group: "Elm, linden & hackberry",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.4108, b1: 2.4177, sg: 0.42,
    moisture: 1.78, brushFrac: 0.40, foliageFrac: 0.13,
    heightA: 80, heightB: 0.036,
    crownIntercept: 5, crownSlope: 1.50,
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
  london_plane: {
    name: "London Plane Tree", scientificName: "Platanus × acerifolia", group: "Sycamore, tulip & mulberry",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.46,
    moisture: 1.80, brushFrac: 0.34, foliageFrac: 0.12,
    heightA: 115, heightB: 0.034,
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
  sweetgum: {
    name: "Sweetgum", scientificName: "Liquidambar styraciflua", group: "Sycamore, tulip & mulberry",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.46,
    moisture: 1.80, brushFrac: 0.35, foliageFrac: 0.12,
    heightA: 100, heightB: 0.035,
    crownIntercept: 6, crownSlope: 1.60,
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
  ginkgo: {
    name: "Ginkgo", scientificName: "Ginkgo biloba", group: "Beech & ginkgo",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.45,
    moisture: 1.70, brushFrac: 0.35, foliageFrac: 0.13,
    heightA: 80, heightB: 0.034,
    crownIntercept: 4, crownSlope: 1.20,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },
  black_tupelo: {
    name: "Black Tupelo / Black Gum", scientificName: "Nyssa sylvatica", group: "Beech & ginkgo",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.46,
    moisture: 1.80, brushFrac: 0.38, foliageFrac: 0.13,
    heightA: 85, heightB: 0.036,
    crownIntercept: 5, crownSlope: 1.50,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },
  katsura: {
    name: "Katsura", scientificName: "Cercidiphyllum japonicum", group: "Beech & ginkgo",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.40,
    moisture: 1.85, brushFrac: 0.40, foliageFrac: 0.14,
    heightA: 75, heightB: 0.038,
    crownIntercept: 5, crownSlope: 1.50,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },
  american_hornbeam: {
    name: "American Hornbeam / Musclewood", scientificName: "Carpinus caroliniana", group: "Beech & ginkgo",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.58,
    moisture: 1.65, brushFrac: 0.45, foliageFrac: 0.13,
    heightA: 35, heightB: 0.055,
    crownIntercept: 4, crownSlope: 1.40,
    brushHandling: 'wide', diamGroup: 'hardwood_heavy'
  },
  european_hornbeam: {
    name: "European Hornbeam", scientificName: "Carpinus betulus", group: "Beech & ginkgo",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.58,
    moisture: 1.65, brushFrac: 0.42, foliageFrac: 0.12,
    heightA: 60, heightB: 0.040,
    crownIntercept: 5, crownSlope: 1.60,
    brushHandling: 'wide', diamGroup: 'hardwood_heavy'
  },
  hophornbeam: {
    name: "American Hophornbeam / Ironwood", scientificName: "Ostrya virginiana", group: "Beech & ginkgo",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.63,
    moisture: 1.60, brushFrac: 0.40, foliageFrac: 0.12,
    heightA: 40, heightB: 0.050,
    crownIntercept: 4, crownSlope: 1.30,
    brushHandling: 'upright', diamGroup: 'hardwood_heavy'
  },
  sourwood: {
    name: "Sourwood", scientificName: "Oxydendrum arboreum", group: "Magnolia & catalpa",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.50,
    moisture: 1.75, brushFrac: 0.45, foliageFrac: 0.13,
    heightA: 50, heightB: 0.045,
    crownIntercept: 4, crownSlope: 1.30,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },
  american_holly: {
    name: "American Holly", scientificName: "Ilex opaca", group: "Magnolia & catalpa",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.51,
    moisture: 1.75, brushFrac: 0.50, foliageFrac: 0.16,
    heightA: 45, heightB: 0.048,
    crownIntercept: 4, crownSlope: 1.30,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },
  sassafras: {
    name: "Sassafras", scientificName: "Sassafras albidum", group: "Magnolia & catalpa",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.42,
    moisture: 1.80, brushFrac: 0.45, foliageFrac: 0.14,
    heightA: 65, heightB: 0.042,
    crownIntercept: 5, crownSlope: 1.50,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },
  kentucky_coffeetree: {
    name: "Kentucky Coffeetree", scientificName: "Gymnocladus dioicus", group: "Magnolia & catalpa",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.53,
    moisture: 1.68, brushFrac: 0.28, foliageFrac: 0.11,
    heightA: 80, heightB: 0.038,
    crownIntercept: 6, crownSlope: 1.70,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },
  yellowwood: {
    name: "Yellowwood", scientificName: "Cladrastis kentukea", group: "Magnolia & catalpa",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.45,
    moisture: 1.78, brushFrac: 0.38, foliageFrac: 0.12,
    heightA: 55, heightB: 0.044,
    crownIntercept: 5, crownSlope: 1.60,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
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
  sweetbay_magnolia: {
    name: "Sweetbay Magnolia", scientificName: "Magnolia virginiana", group: "Magnolia & catalpa",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.40,
    moisture: 1.82, brushFrac: 0.50, foliageFrac: 0.15,
    heightA: 35, heightB: 0.052,
    crownIntercept: 4, crownSlope: 1.40,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },
  southern_magnolia: {
    name: "Southern Magnolia", scientificName: "Magnolia grandiflora", group: "Magnolia & catalpa",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.46,
    moisture: 1.78, brushFrac: 0.45, foliageFrac: 0.16,
    heightA: 70, heightB: 0.038,
    crownIntercept: 6, crownSlope: 1.70,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
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
  mulberry: {
    name: "Mulberry", scientificName: "Morus spp.", group: "Sycamore, tulip & mulberry",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.59,
    moisture: 1.65, brushFrac: 0.50, foliageFrac: 0.14,
    heightA: 50, heightB: 0.050,
    crownIntercept: 5, crownSlope: 1.50,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },
  white_mulberry: {
    name: "White Mulberry", scientificName: "Morus alba", group: "Sycamore, tulip & mulberry",
    pickerCategory: "Broadleaf · more kinds",
    b0: -2.2118, b1: 2.4133, sg: 0.58,
    moisture: 1.68, brushFrac: 0.50, foliageFrac: 0.14,
    heightA: 45, heightB: 0.050,
    crownIntercept: 5, crownSlope: 1.50,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
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

  // ===== SPECIALTY ORNAMENTALS =====
  japanese_tree_lilac: {
    name: "Japanese Tree Lilac", scientificName: "Syringa reticulata", group: "Specialty ornamentals",
    pickerCategory: "Specialty ornamentals",
    b0: -2.2118, b1: 2.4133, sg: 0.53,
    moisture: 1.70, brushFrac: 0.48, foliageFrac: 0.13,
    heightA: 28, heightB: 0.060,
    crownIntercept: 4, crownSlope: 1.30,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },
  persian_ironwood: {
    name: "Persian Ironwood", scientificName: "Parrotia persica", group: "Specialty ornamentals",
    pickerCategory: "Specialty ornamentals",
    b0: -2.2118, b1: 2.4133, sg: 0.55,
    moisture: 1.65, brushFrac: 0.45, foliageFrac: 0.13,
    heightA: 25, heightB: 0.062,
    crownIntercept: 5, crownSlope: 1.70,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  stewartia: {
    name: "Japanese Stewartia", scientificName: "Stewartia pseudocamellia", group: "Specialty ornamentals",
    pickerCategory: "Specialty ornamentals",
    b0: -2.2118, b1: 2.4133, sg: 0.50,
    moisture: 1.72, brushFrac: 0.48, foliageFrac: 0.14,
    heightA: 22, heightB: 0.064,
    crownIntercept: 4, crownSlope: 1.40,
    brushHandling: 'upright', diamGroup: 'hardwood_normal'
  },
  silverbell: {
    name: "Carolina Silverbell", scientificName: "Halesia tetraptera", group: "Specialty ornamentals",
    pickerCategory: "Specialty ornamentals",
    b0: -2.2118, b1: 2.4133, sg: 0.44,
    moisture: 1.80, brushFrac: 0.50, foliageFrac: 0.14,
    heightA: 35, heightB: 0.055,
    crownIntercept: 5, crownSlope: 1.50,
    brushHandling: 'wide', diamGroup: 'hardwood_normal'
  },
  fringetree: {
    name: "White Fringetree", scientificName: "Chionanthus virginicus", group: "Specialty ornamentals",
    pickerCategory: "Specialty ornamentals",
    b0: -2.2118, b1: 2.4133, sg: 0.46,
    moisture: 1.80, brushFrac: 0.55, foliageFrac: 0.15,
    heightA: 20, heightB: 0.068,
    crownIntercept: 4, crownSlope: 1.40,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },
  smoketree: {
    name: "American Smoketree", scientificName: "Cotinus obovatus", group: "Specialty ornamentals",
    pickerCategory: "Specialty ornamentals",
    b0: -2.2118, b1: 2.4133, sg: 0.42,
    moisture: 1.75, brushFrac: 0.52, foliageFrac: 0.15,
    heightA: 25, heightB: 0.062,
    crownIntercept: 4, crownSlope: 1.40,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },

  // ===== SOUTHERN & WESTERN SPECIES =====
  crape_myrtle: {
    name: "Crape Myrtle", scientificName: "Lagerstroemia spp.", group: "Southern & western",
    pickerCategory: "Southern & western",
    b0: -2.2118, b1: 2.4133, sg: 0.45,
    moisture: 1.72, brushFrac: 0.50, foliageFrac: 0.14,
    heightA: 25, heightB: 0.062,
    crownIntercept: 4, crownSlope: 1.40,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },
  desert_willow: {
    name: "Desert Willow", scientificName: "Chilopsis linearis", group: "Southern & western",
    pickerCategory: "Southern & western",
    b0: -2.2118, b1: 2.4133, sg: 0.35,
    moisture: 1.80, brushFrac: 0.55, foliageFrac: 0.14,
    heightA: 25, heightB: 0.062,
    crownIntercept: 4, crownSlope: 1.40,
    brushHandling: 'spreading', diamGroup: 'hardwood_normal'
  },
  blue_palo_verde: {
    name: "Blue Palo Verde", scientificName: "Parkinsonia florida", group: "Southern & western",
    pickerCategory: "Southern & western",
    b0: -2.2118, b1: 2.4133, sg: 0.32,
    moisture: 1.75, brushFrac: 0.55, foliageFrac: 0.14,
    heightA: 22, heightB: 0.065,
    crownIntercept: 5, crownSlope: 1.60,
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
  austrian_pine: {
    name: "Austrian / Black Pine", scientificName: "Pinus nigra", group: "Pines",
    pickerCategory: "Conifers",
    b0: -3.0506, b1: 2.6465, sg: 0.44,
    moisture: 1.85, brushFrac: 0.52, foliageFrac: 0.20,
    heightA: 80, heightB: 0.038,
    crownIntercept: 4, crownSlope: 1.20,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'soft_branch'
  },
  ponderosa_pine: {
    name: "Ponderosa Pine", scientificName: "Pinus ponderosa", group: "Pines",
    pickerCategory: "Conifers",
    b0: -3.0506, b1: 2.6465, sg: 0.38,
    moisture: 1.90, brushFrac: 0.50, foliageFrac: 0.20,
    heightA: 120, heightB: 0.030,
    crownIntercept: 4, crownSlope: 1.10,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'soft_branch'
  },
  longleaf_pine: {
    name: "Longleaf Pine", scientificName: "Pinus palustris", group: "Pines",
    pickerCategory: "Conifers",
    b0: -3.0506, b1: 2.6465, sg: 0.44,
    moisture: 1.85, brushFrac: 0.50, foliageFrac: 0.20,
    heightA: 100, heightB: 0.033,
    crownIntercept: 4, crownSlope: 1.10,
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
  serbian_spruce: {
    name: "Serbian Spruce", scientificName: "Picea omorika", group: "Spruce, hemlock & arborvitae",
    pickerCategory: "Conifers",
    b0: -2.1364, b1: 2.3233, sg: 0.35,
    moisture: 1.95, brushFrac: 0.62, foliageFrac: 0.30,
    heightA: 80, heightB: 0.036,
    crownIntercept: 3, crownSlope: 0.90,
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
  douglas_fir: {
    name: "Douglas Fir", scientificName: "Pseudotsuga menziesii", group: "Spruce, hemlock & arborvitae",
    pickerCategory: "Conifers",
    b0: -2.1364, b1: 2.3233, sg: 0.45,
    moisture: 1.88, brushFrac: 0.55, foliageFrac: 0.25,
    heightA: 120, heightB: 0.028,
    crownIntercept: 5, crownSlope: 1.20,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'soft_branch'
  },
  balsam_fir: {
    name: "Balsam Fir", scientificName: "Abies balsamea", group: "Spruce, hemlock & arborvitae",
    pickerCategory: "Conifers",
    b0: -2.3480, b1: 2.3876, sg: 0.33,
    moisture: 2.00, brushFrac: 0.62, foliageFrac: 0.32,
    heightA: 70, heightB: 0.040,
    crownIntercept: 3, crownSlope: 0.90,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'soft_branch'
  },
  fraser_fir: {
    name: "Fraser Fir", scientificName: "Abies fraseri", group: "Spruce, hemlock & arborvitae",
    pickerCategory: "Conifers",
    b0: -2.3480, b1: 2.3876, sg: 0.33,
    moisture: 2.00, brushFrac: 0.62, foliageFrac: 0.32,
    heightA: 50, heightB: 0.044,
    crownIntercept: 3, crownSlope: 0.90,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'soft_branch'
  },
  white_fir: {
    name: "White Fir", scientificName: "Abies concolor", group: "Spruce, hemlock & arborvitae",
    pickerCategory: "Conifers",
    b0: -2.3480, b1: 2.3876, sg: 0.34,
    moisture: 1.95, brushFrac: 0.60, foliageFrac: 0.28,
    heightA: 90, heightB: 0.034,
    crownIntercept: 4, crownSlope: 1.10,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'soft_branch'
  },
  european_larch: {
    name: "European Larch", scientificName: "Larix decidua", group: "Spruce, hemlock & arborvitae",
    pickerCategory: "Conifers",
    b0: -2.3480, b1: 2.3876, sg: 0.46,
    moisture: 1.85, brushFrac: 0.55, foliageFrac: 0.25,
    heightA: 100, heightB: 0.032,
    crownIntercept: 4, crownSlope: 1.10,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'soft_branch'
  },
  japanese_larch: {
    name: "Japanese Larch", scientificName: "Larix kaempferi", group: "Spruce, hemlock & arborvitae",
    pickerCategory: "Conifers",
    b0: -2.3480, b1: 2.3876, sg: 0.44,
    moisture: 1.85, brushFrac: 0.55, foliageFrac: 0.25,
    heightA: 80, heightB: 0.036,
    crownIntercept: 4, crownSlope: 1.10,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'soft_branch'
  },
  bald_cypress: {
    name: "Bald Cypress", scientificName: "Taxodium distichum", group: "Spruce, hemlock & arborvitae",
    pickerCategory: "Conifers",
    b0: -2.3480, b1: 2.3876, sg: 0.42,
    moisture: 1.90, brushFrac: 0.55, foliageFrac: 0.28,
    heightA: 100, heightB: 0.032,
    crownIntercept: 4, crownSlope: 1.20,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'soft_branch'
  },
  dawn_redwood: {
    name: "Dawn Redwood", scientificName: "Metasequoia glyptostroboides", group: "Spruce, hemlock & arborvitae",
    pickerCategory: "Conifers",
    b0: -2.3480, b1: 2.3876, sg: 0.35,
    moisture: 1.95, brushFrac: 0.58, foliageFrac: 0.28,
    heightA: 100, heightB: 0.032,
    crownIntercept: 3, crownSlope: 0.95,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'soft_branch'
  },
  japanese_cedar: {
    name: "Japanese Cedar / Cryptomeria", scientificName: "Cryptomeria japonica", group: "Spruce, hemlock & arborvitae",
    pickerCategory: "Conifers",
    b0: -2.7765, b1: 2.4195, sg: 0.32,
    moisture: 2.00, brushFrac: 0.65, foliageFrac: 0.33,
    heightA: 100, heightB: 0.030,
    crownIntercept: 3, crownSlope: 0.85,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'lead_only'
  },
  leyland_cypress: {
    name: "Leyland Cypress", scientificName: "Cupressus × leylandii", group: "Spruce, hemlock & arborvitae",
    pickerCategory: "Conifers",
    b0: -2.7765, b1: 2.4195, sg: 0.32,
    moisture: 2.00, brushFrac: 0.65, foliageFrac: 0.34,
    heightA: 70, heightB: 0.042,
    crownIntercept: 2, crownSlope: 0.80,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'lead_only'
  },
  arizona_cypress: {
    name: "Arizona Cypress", scientificName: "Cupressus arizonica", group: "Spruce, hemlock & arborvitae",
    pickerCategory: "Southern & western",
    b0: -2.7765, b1: 2.4195, sg: 0.35,
    moisture: 1.95, brushFrac: 0.63, foliageFrac: 0.32,
    heightA: 50, heightB: 0.044,
    crownIntercept: 3, crownSlope: 0.90,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'lead_only'
  },
  eastern_red_cedar: {
    name: "Eastern Red Cedar", scientificName: "Juniperus virginiana", group: "Spruce, hemlock & arborvitae",
    pickerCategory: "Conifers",
    b0: -2.7765, b1: 2.4195, sg: 0.37,
    moisture: 1.95, brushFrac: 0.65, foliageFrac: 0.34,
    heightA: 50, heightB: 0.045,
    crownIntercept: 2, crownSlope: 0.75,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'lead_only'
  },
  western_red_cedar: {
    name: "Western Red Cedar", scientificName: "Thuja plicata", group: "Spruce, hemlock & arborvitae",
    pickerCategory: "Conifers",
    b0: -2.7765, b1: 2.4195, sg: 0.32,
    moisture: 2.00, brushFrac: 0.65, foliageFrac: 0.32,
    heightA: 140, heightB: 0.025,
    crownIntercept: 3, crownSlope: 0.90,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'lead_only'
  },
  arborvitae: {
    name: "Arborvitae / White Cedar", scientificName: "Thuja occidentalis", group: "Spruce, hemlock & arborvitae",
    pickerCategory: "Conifers",
    b0: -2.7765, b1: 2.4195, sg: 0.31,
    moisture: 2.00, brushFrac: 0.65, foliageFrac: 0.35,
    heightA: 50, heightB: 0.045,
    crownIntercept: 2, crownSlope: 0.70,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'lead_only'
  },

  // ===== PALMS =====
  // Note: palms are single-stem; allometric b0/b1 are approximations only.
  // brushFrac≈0.02 (no branch brush), foliageFrac≈0.45 (heavy fronds).
  sabal_palm: {
    name: "Cabbage / Sabal Palm", scientificName: "Sabal palmetto", group: "Palms",
    pickerCategory: "Palms",
    b0: -2.6177, b1: 2.4638, sg: 0.30,
    moisture: 2.10, brushFrac: 0.02, foliageFrac: 0.45,
    heightA: 50, heightB: 0.038,
    crownIntercept: 5, crownSlope: 0.00,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'lead_only'
  },
  canary_palm: {
    name: "Canary Island Date Palm", scientificName: "Phoenix canariensis", group: "Palms",
    pickerCategory: "Palms",
    b0: -2.6177, b1: 2.4638, sg: 0.32,
    moisture: 2.00, brushFrac: 0.02, foliageFrac: 0.50,
    heightA: 50, heightB: 0.038,
    crownIntercept: 8, crownSlope: 0.00,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'lead_only'
  },
  date_palm: {
    name: "Date Palm", scientificName: "Phoenix dactylifera", group: "Palms",
    pickerCategory: "Palms",
    b0: -2.6177, b1: 2.4638, sg: 0.30,
    moisture: 2.00, brushFrac: 0.02, foliageFrac: 0.50,
    heightA: 65, heightB: 0.035,
    crownIntercept: 7, crownSlope: 0.00,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'lead_only'
  },
  queen_palm: {
    name: "Queen Palm", scientificName: "Syagrus romanzoffiana", group: "Palms",
    pickerCategory: "Palms",
    b0: -2.6177, b1: 2.4638, sg: 0.26,
    moisture: 2.10, brushFrac: 0.02, foliageFrac: 0.50,
    heightA: 50, heightB: 0.040,
    crownIntercept: 6, crownSlope: 0.00,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'lead_only'
  },
  mexican_fan_palm: {
    name: "Mexican Fan Palm", scientificName: "Washingtonia robusta", group: "Palms",
    pickerCategory: "Palms",
    b0: -2.6177, b1: 2.4638, sg: 0.24,
    moisture: 2.10, brushFrac: 0.02, foliageFrac: 0.40,
    heightA: 80, heightB: 0.030,
    crownIntercept: 4, crownSlope: 0.00,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'lead_only'
  },
  california_fan_palm: {
    name: "California Fan Palm", scientificName: "Washingtonia filifera", group: "Palms",
    pickerCategory: "Palms",
    b0: -2.6177, b1: 2.4638, sg: 0.26,
    moisture: 2.10, brushFrac: 0.02, foliageFrac: 0.42,
    heightA: 60, heightB: 0.035,
    crownIntercept: 6, crownSlope: 0.00,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'lead_only'
  },
  windmill_palm: {
    name: "Windmill Palm", scientificName: "Trachycarpus fortunei", group: "Palms",
    pickerCategory: "Palms",
    b0: -2.6177, b1: 2.4638, sg: 0.28,
    moisture: 2.10, brushFrac: 0.02, foliageFrac: 0.45,
    heightA: 30, heightB: 0.050,
    crownIntercept: 4, crownSlope: 0.00,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'lead_only'
  },
  pindo_palm: {
    name: "Pindo / Jelly Palm", scientificName: "Butia capitata", group: "Palms",
    pickerCategory: "Palms",
    b0: -2.6177, b1: 2.4638, sg: 0.30,
    moisture: 2.05, brushFrac: 0.02, foliageFrac: 0.48,
    heightA: 20, heightB: 0.060,
    crownIntercept: 5, crownSlope: 0.00,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'lead_only'
  },
  royal_palm: {
    name: "Royal Palm", scientificName: "Roystonea spp.", group: "Palms",
    pickerCategory: "Palms",
    b0: -2.6177, b1: 2.4638, sg: 0.28,
    moisture: 2.10, brushFrac: 0.02, foliageFrac: 0.45,
    heightA: 70, heightB: 0.032,
    crownIntercept: 6, crownSlope: 0.00,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'lead_only'
  },
  coconut_palm: {
    name: "Coconut Palm", scientificName: "Cocos nucifera", group: "Palms",
    pickerCategory: "Palms",
    b0: -2.6177, b1: 2.4638, sg: 0.28,
    moisture: 2.10, brushFrac: 0.02, foliageFrac: 0.50,
    heightA: 60, heightB: 0.035,
    crownIntercept: 7, crownSlope: 0.00,
    brushHandling: 'conifer', diamGroup: 'conifer', absorbProfile: 'lead_only'
  },
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
 * Subgroups favour ≥3 entries; "Nut trees", "Soft hardwoods", etc. encode intent.
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
  "Specialty ornamentals",
  "Southern & western",
  "Palms",
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
  "Specialty ornamentals": ["Specialty ornamentals"],
  "Southern & western": ["Southern & western"],
  "Palms": ["Palms"],
  Conifers: ["Pines", "Spruce, hemlock & arborvitae"],
};
