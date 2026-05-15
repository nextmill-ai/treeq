// Compares compute(silver_maple, 18, 0) between current index.html and v1.8 baseline.
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function getCompute(filePath, speciesKey, dbh, trimPct) {
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

const newIdx = resolve(__dirname, '..', 'index.html');
const oldIdx = resolve(__dirname, '..', 'index-v1.8-pre-picker.html');

const speciesKey = 'silver_maple';
const dbh = 18, trim = 0;

const a = await getCompute(newIdx, speciesKey, dbh, trim);
const b = await getCompute(oldIdx, speciesKey, dbh, trim);

console.log('current :', JSON.stringify(a));
console.log('v1.8    :', JSON.stringify(b));

if (a.error || b.error) { console.error('compute() not exposed in one of the files'); process.exit(2); }
const tolSec = 0.001;
const dt = Math.abs((a.totalSec || 0) - (b.totalSec || 0));
console.log(`|Δ totalSec| = ${dt.toFixed(6)}s  (tol ±${tolSec})`);
process.exit(dt <= tolSec ? 0 : 1);
