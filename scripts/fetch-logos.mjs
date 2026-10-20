import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mapPath = process.argv[2];
if (!mapPath) {
  console.error('usage: node scripts/fetch-logos.mjs <map.json>');
  process.exit(1);
}
const map = JSON.parse(readFileSync(mapPath, 'utf8'));
const out = 'public/logos';
mkdirSync(out, { recursive: true });

const isImage = (b) =>
  (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) || // PNG
  (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) || // JPEG
  (b.length > 4 && b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0); // ICO

const isPng = (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

// Saves image bytes as a real PNG. JPEG and ICO are converted with sips (macOS); elsewhere the bytes are kept as is.
function savePng(dest, buf) {
  if (isPng(buf)) return writeFileSync(dest, buf);
  const src = join(tmpdir(), `logo-${process.pid}-${Math.random().toString(36).slice(2)}`);
  writeFileSync(src, buf);
  try {
    execFileSync('sips', ['-s', 'format', 'png', src, '--out', dest], { stdio: 'ignore' });
  } catch {
    console.error(`warning: cannot convert ${dest} to PNG (sips unavailable); saved original bytes`);
    writeFileSync(dest, buf);
  } finally {
    rmSync(src, { force: true });
  }
}

const failed = [];
for (const domain of [...new Set(map.solutions.map((s) => s.domain))]) {
  const dest = `${out}/${domain}.png`;
  if (existsSync(dest)) continue;
  const local = `data/logos/${domain}.png`;
  if (existsSync(local)) {
    const bytes = readFileSync(local);
    if (isImage(bytes)) {
      savePng(dest, bytes);
      console.log(`copied  ${domain}`);
      continue;
    }
    console.error(`skipped data/logos/${domain}.png: not an image, fetching instead`);
  }
  try {
    const res = await fetch(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (!isImage(buf)) throw new Error('not an image');
    savePng(dest, buf);
    console.log(`fetched ${domain}`);
  } catch (e) {
    failed.push(domain);
    console.error(`FAILED  ${domain}: ${e.message}`);
  }
}
if (failed.length) {
  console.error(`${failed.length} failed: ${failed.join(', ')}`);
  process.exit(1);
}
