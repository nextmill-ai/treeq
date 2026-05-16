// GET /.netlify/functions/estimate → /api/estimate via netlify.toml
// Thin-client calculator — compute() stays server-side.

import { compute } from "./_lib/estimator/math.js";
import { SPECIES } from "./_lib/estimator/species-db.js";

const JSON_HDR = { "Content-Type": "application/json" };
const cors = () => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
});

function bad(message, status = 400, headers = {}) {
  return {
    statusCode: status,
    headers: { ...JSON_HDR, ...cors(), ...headers },
    body: JSON.stringify({ error: message }),
  };
}

export const handler = async (event) => {
  const c = cors();
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: c, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return bad("Method not allowed", 405);
  }

  const qp = event.queryStringParameters || {};
  const speciesKey = qp.species;
  const dbhRaw = qp.dbh;
  const trimRaw = qp.trim ?? "0";

  if (!speciesKey || !SPECIES[speciesKey]) return bad("unknown or missing species");
  const dbh = parseFloat(dbhRaw);
  if (!Number.isFinite(dbh) || dbh < 1 || dbh > 100) return bad("bad dbh (1..100)");
  const trim = parseFloat(trimRaw);
  if (!Number.isFinite(trim) || trim < 0 || trim > 100) return bad("bad trim (0..100)");

  let result;
  try {
    result = compute(speciesKey, dbh, trim);
  } catch (err) {
    return bad("compute failed: " + (err.message || "unknown"), 500);
  }

  return {
    statusCode: 200,
    headers: {
      ...JSON_HDR,
      ...c,
      "Cache-Control": "public, max-age=300",
    },
    body: JSON.stringify(result),
  };
};
