// GET /api/estimate?species={key}&dbh={number}&trim={number}
// Returns the full computation result. Calls compute() server-side; the math
// engine and species DB never reach the browser.

import { compute } from '../lib/math.js';
import { SPECIES } from '../lib/species-db.js';

function bad(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const speciesKey = url.searchParams.get('species');
  const dbhRaw = url.searchParams.get('dbh');
  const trimRaw = url.searchParams.get('trim');

  if (!speciesKey || !SPECIES[speciesKey]) return bad('unknown or missing species');
  const dbh = parseFloat(dbhRaw);
  if (!Number.isFinite(dbh) || dbh < 1 || dbh > 100) return bad('bad dbh (1..100)');
  const trim = parseFloat(trimRaw ?? '0');
  if (!Number.isFinite(trim) || trim < 0 || trim > 100) return bad('bad trim (0..100)');

  let result;
  try {
    result = compute(speciesKey, dbh, trim);
  } catch (err) {
    return bad('compute failed: ' + (err.message || 'unknown'), 500);
  }

  return new Response(JSON.stringify(result), {
    headers: {
      'Content-Type': 'application/json',
      // Cache identical inputs for 5 minutes; safe because the math is pure.
      'Cache-Control': 'public, max-age=300'
    }
  });
}
