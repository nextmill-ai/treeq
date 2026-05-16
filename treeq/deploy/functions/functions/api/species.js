// GET /api/species
// Returns picker metadata + flat species rows (each has category + group).
// IMPORTANT: do NOT expose biomass coefficients or calibration constants.

import {
  SPECIES,
  PICKER_CATEGORY_ORDER,
  PICKER_GROUP_ORDER_BY_CATEGORY,
} from '../lib/species-db.js';

export async function onRequestGet() {
  const byCat = {};
  for (const [key, sp] of Object.entries(SPECIES)) {
    const cat = sp.pickerCategory;
    const grp = sp.group;
    if (!byCat[cat]) byCat[cat] = {};
    if (!byCat[cat][grp]) byCat[cat][grp] = [];
    byCat[cat][grp].push({
      key,
      name: sp.name,
      scientificName: sp.scientificName || '',
      category: cat,
      group: grp,
    });
  }

  const list = [];
  for (const cat of PICKER_CATEGORY_ORDER) {
    const grpOrder = PICKER_GROUP_ORDER_BY_CATEGORY[cat];
    const catBucket = byCat[cat];
    if (!catBucket || !grpOrder) continue;
    const seen = new Set(grpOrder);
    for (const g of grpOrder) {
      if (!catBucket[g]) continue;
      catBucket[g].sort((a, b) => a.name.localeCompare(b.name));
      list.push(...catBucket[g]);
    }
    const orphans = Object.keys(catBucket).filter((g) => !seen.has(g)).sort();
    for (const g of orphans) {
      catBucket[g].sort((a, b) => a.name.localeCompare(b.name));
      list.push(...catBucket[g]);
    }
  }

  return new Response(
    JSON.stringify({
      categories: PICKER_CATEGORY_ORDER,
      groupOrderByCategory: PICKER_GROUP_ORDER_BY_CATEGORY,
      species: list,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    }
  );
}
