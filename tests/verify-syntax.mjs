// Extract inline <script> from index.html and run node --check on it.
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexPath = resolve(__dirname, '..', 'index.html');
const html = readFileSync(indexPath, 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('No inline <script> block found.'); process.exit(2); }
const tmp = resolve(tmpdir(), 'treeq-syntax-check.mjs');
writeFileSync(tmp, m[1]);
try {
  execSync(`node --check "${tmp}"`, { stdio: 'inherit' });
  console.log('JS SYNTAX OK');
} catch (e) {
  console.error('JS SYNTAX FAIL');
  process.exit(1);
}

const size = statSync(indexPath).size;
console.log(`File size: ${size} bytes (${(size/1024).toFixed(1)} KB)`);
const sizeOk = size >= 110*1024 && size <= 125*1024;
console.log(`Size in 110–125 KB range: ${sizeOk ? 'OK' : 'OUT OF RANGE'}`);

const closeScript = (html.match(/<\/script>/g) || []).length;
const closeBody   = (html.match(/<\/body>/g) || []).length;
const closeHtml   = (html.match(/<\/html>/g) || []).length;
console.log(`</script>=${closeScript} </body>=${closeBody} </html>=${closeHtml}`);
