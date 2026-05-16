// Compares compute(silver_maple, 18, 0) between root index.html (browser) and
// deploy/functions/lib/math.js (server). The old index-v1.8-pre-picker.html
// baseline was truncated in-repo; server math is the canonical split-deploy source.
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { compute as computeServer } from '../deploy/functions/lib/math.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function pick(r) {
  return {
    totalSec: r.totalSec,
    brushSecTotal: r.brushSecTotal,
    logSec: r.logSec,
    brushCuts: r.brushCuts,
    logCutsTotal: r.logCutsTotal,
    totalCuts: r.totalCuts
  };
}

async function getComputeBrowser(filePath, speciesKey, dbh, trimPct) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(filePath).href, { waitUntil: 'load' });
  await page.waitForTimeout(200);
  const out = await page.evaluate(({ k, d, t }) => {
    if (typeof compute !== 'function') return { error: 'compute not in scope' };
    const r = compute(k, d, t);
    return {
      totalSec: r.totalSec,
      brushSecTotal: r.brushSecTotal,
      logSec: r.logSec,
      brushCuts: r.brushCuts,
      logCutsTotal: r.logCutsTotal,
      totalCuts: r.totalCuts
    };
  }, { k: speciesKey, d: dbh, t: trimPct });
  await browser.close();
  return out;
}

const idx = resolve(__dirname, '..', 'index.html');
const speciesKey = 'silver_maple';
const dbh = 18, trim = 0;

const browserOut = await getComputeBrowser(idx, speciesKey, dbh, trim);
const serverOut = pick(computeServer(speciesKey, dbh, trim));

console.log('browser (index.html) :', JSON.stringify(browserOut));
console.log('server (math.js)     :', JSON.stringify(serverOut));

if (browserOut.error) {
  console.error('compute() not exposed in index.html');
  process.exit(2);
}
const tolSec = 0.001;
const dt = Math.abs((browserOut.totalSec || 0) - (serverOut.totalSec || 0));
console.log(`|Δ totalSec| = ${dt.toFixed(6)}s  (tol ±${tolSec})`);
process.exit(dt <= tolSec ? 0 : 1);
