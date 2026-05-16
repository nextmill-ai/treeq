// v2.3 thin-client smoke: file:// load + mocked /api/species and /api/estimate.
// Run: node tests/v23-picker-smoke.mjs

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { compute } from '../netlify/functions/_lib/estimator/math.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexUrl = pathToFileURL(resolve(__dirname, '..', 'index.html')).href;

const SPECIES_JSON = {
  categories: ['Maples'],
  groupOrderByCategory: { Maples: ['Maples'] },
  species: [
    {
      key: 'silver_maple',
      name: 'Silver Maple',
      scientificName: 'Acer saccharinum',
      category: 'Maples',
      group: 'Maples',
    },
  ],
};

const estimateJson = compute('silver_maple', 24, 5);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 480, height: 820 } });
const page = await ctx.newPage();

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.addInitScript(
  ({ speciesJson: sPayload, estimateJson: ePayload }) => {
    const orig = window.fetch.bind(window);
    window.fetch = async function (input, init) {
      const url = typeof input === 'string' ? input : input.url;
      const u = String(url);
      if (u.includes('api/species')) {
        return new Response(JSON.stringify(sPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (u.includes('api/estimate')) {
        return new Response(JSON.stringify(ePayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return orig(input, init);
    };
  },
  { speciesJson: SPECIES_JSON, estimateJson }
);

await page.goto(indexUrl, { waitUntil: 'load' });
await page.waitForTimeout(500);

if (errors.length) {
  console.error('FAIL — console errors:', errors);
  process.exit(1);
}

const opts = page.locator('#species option');
const n = await opts.count();
if (n < 1) {
  console.error('FAIL — no #species options');
  process.exit(1);
}

for (let i = 0; i < n; i++) {
  const t = ((await opts.nth(i).textContent()) || '').trim();
  if (!t.includes('(') || !t.includes(')')) {
    console.error('FAIL — option missing parenthetical Latin:', JSON.stringify(t));
    process.exit(1);
  }
}

const hero = ((await page.locator('#heroTitle').textContent()) || '').trim();
const latin = (estimateJson.speciesScientificName || '').trim();
if (!latin || !hero.includes(latin)) {
  console.error('FAIL — hero missing Latin', { hero, latin });
  process.exit(1);
}

console.log('PASS — v2.3 picker smoke', { hero });
await browser.close();
process.exit(0);
