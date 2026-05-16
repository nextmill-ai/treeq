// GET /.netlify/functions/species → /api/species via netlify.toml
// Same payload as Cloudflare Pages /api/species.

import {
  SPECIES,
  PICKER_CATEGORY_ORDER,
  PICKER_GROUP_ORDER_BY_CATEGORY,
} from "./_lib/estimator/species-db.js";

const JSON_HDR = { "Content-Type": "application/json" };
const cors = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
});

function buildSpeciesPayload() {
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

  return JSON.stringify({
    categories: PICKER_CATEGORY_ORDER,
    groupOrderByCategory: PICKER_GROUP_ORDER_BY_CATEGORY,
    species: list,
  });
}

export const handler = async (event) => {
  const c = cors();
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: c, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { ...JSON_HDR, ...c },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  return {
    statusCode: 200,
    headers: {
      ...JSON_HDR,
      ...c,
      "Cache-Control": "public, max-age=3600",
    },
    body: buildSpeciesPayload(),
  };
};
