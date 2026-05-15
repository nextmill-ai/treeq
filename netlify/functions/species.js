// GET /.netlify/functions/species → /api/species via netlify.toml
// Public species metadata only — no calibrated coefficients.

import { SPECIES, GROUP_ORDER } from "./_lib/estimator/species-db.js";

const JSON_HDR = { "Content-Type": "application/json" };
const cors = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
});

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

  const byGroup = {};
  for (const [key, sp] of Object.entries(SPECIES)) {
    if (!byGroup[sp.group]) byGroup[sp.group] = [];
    byGroup[sp.group].push({ key, name: sp.name, group: sp.group });
  }
  const list = [];
  for (const g of GROUP_ORDER) {
    if (byGroup[g]) list.push(...byGroup[g]);
  }

  return {
    statusCode: 200,
    headers: {
      ...JSON_HDR,
      ...c,
      "Cache-Control": "public, max-age=3600",
    },
    body: JSON.stringify({ species: list }),
  };
};
