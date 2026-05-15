// GET /api/species
// Returns the public species list: [{key, name, group}].
// IMPORTANT: do NOT include biomass coefficients, moisture, brushFrac,
// foliageFrac, heightA/B, crownIntercept/Slope, or any other calibrated value
// in this response. Those are server-only IP.

import { SPECIES, GROUP_ORDER } from '../lib/species-db.js';

export async function onRequestGet() {
  // Group species in the preferred order, returning only public fields.
  const byGroup = {};
  for (const [key, sp] of Object.entries(SPECIES)) {
    if (!byGroup[sp.group]) byGroup[sp.group] = [];
    byGroup[sp.group].push({ key, name: sp.name, group: sp.group });
  }
  const list = [];
  for (const g of GROUP_ORDER) {
    if (byGroup[g]) list.push(...byGroup[g]);
  }

  return new Response(JSON.stringify({ species: list }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
