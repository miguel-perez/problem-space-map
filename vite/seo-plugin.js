// Build-time SEO: title, description, canonical, Open Graph, Twitter card, JSON-LD, a crawlable text version of
// the map, and sitemap.xml. renderSeo is pure so tests can call it directly.
import { readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { parseMap } from '../src/schema.js';

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const people = (n) => (n === 1 ? '1 person' : n + ' people');

export function renderSeo(map, { hasOg = false } = {}) {
  const site = map.siteUrl ? (map.siteUrl.endsWith('/') ? map.siteUrl : map.siteUrl + '/') : '';
  // og.png sits next to the map; without it (or without a siteUrl to make the URL absolute) there is no image tag.
  const og = hasOg && site ? site + 'og.png' : '';
  const keywords = [...new Set([...map.levels, 'problem space map', ...map.title.split(/\s+/).filter((w) => w.length > 2)])];
  const ld = {
    '@context': 'https://schema.org',
    '@type': ['WebPage', 'Dataset'],
    name: map.title,
    description: map.description,
    ...(site && { url: site }),
    keywords,
    creator: { '@type': 'Person', name: 'Miguel Perez' },
    license: 'https://creativecommons.org/licenses/by/4.0/',
  };
  const meta = (attr, k, v) => `<meta ${attr}="${k}" content="${esc(v)}">`;
  const head = [
    `<title>${esc(map.title)}</title>`,
    meta('name', 'description', map.description),
    site && `<link rel="canonical" href="${esc(site)}">`,
    meta('property', 'og:title', map.title),
    meta('property', 'og:description', map.description),
    meta('property', 'og:type', 'website'),
    site && meta('property', 'og:url', site),
    og && meta('property', 'og:image', og),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', map.title),
    meta('name', 'twitter:description', map.description),
    og && meta('name', 'twitter:image', og),
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`,
  ].filter(Boolean).join('\n  ');

  const kids = (id) => map.sections.filter((s) => s.parent === id);
  const item = (s) => {
    const sub = kids(s.id);
    return `<li>${esc(s.label)} (${people(s.people)})` +
      (sub.length ? `<ul>${sub.map(item).join('')}</ul>` : '') + '</li>';
  };
  const top = map.sections.filter((s) => s.level === 3);
  const sols = map.solutions.map((s) =>
    `<li><a href="${esc(s.url)}">${esc(s.name)}</a> (${s.kind === 'product' ? 'product' : 'general tool'}, ${s.placements.length} ${esc(map.levels[2].toLowerCase())}${s.placements.length === 1 ? '' : 's'})</li>`).join('');
  const body = `<section class="sr-only" id="about">
    <h1>${esc(map.title)}</h1>
    <p>${esc(map.description)}</p>
    <h2>${esc(map.levels[0])}, ${esc(map.levels[1].toLowerCase())} and ${esc(map.levels[2].toLowerCase())}, with the number of people who raised each</h2>
    <ul>${top.map(item).join('')}</ul>
    <h2>Solutions</h2>
    <ul>${sols}</ul>
    ${map.note ? `<p>${esc(map.note)}</p>` : ''}
  </section>`;

  const sitemap = site
    ? `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${esc(site)}</loc></url>\n</urlset>\n`
    : '';
  const robots = `User-agent: *\nAllow: /\n${site ? `\nSitemap: ${site}sitemap.xml\n` : ''}`;
  return { head, body, sitemap, robots };
}

// Function replacers: map text may contain $&, $' or $$, which String.replace would expand in a string replacement.
export function injectSeo(html, seo) {
  return html
    .replace(/<title>[\s\S]*?<\/title>\s*/, '')
    .replace('<!-- seo:head -->', () => seo.head)
    .replace('<!-- seo:body -->', () => seo.body);
}

// Reads, validates and returns the map at `mapPath` (relative to `root`, or absolute). Throws a clear error otherwise.
export function loadMap(root, mapPath) {
  const file = resolve(root, mapPath);
  if (!existsSync(file)) throw new Error(`MAP: no file at ${mapPath} (resolved to ${file}).`);
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`MAP: ${mapPath} is not valid JSON: ${e.message}`);
  }
  try {
    return { file, map: parseMap(raw) };
  } catch (e) {
    throw new Error(`MAP: ${mapPath} is not a valid map: ${e.message}`);
  }
}

// SEO tags plus `virtual:map`, a module holding only the chosen map, and only that map's logos, so nothing from
// another map ships in the build.
const VIRTUAL = 'virtual:map';
export function seoPlugin(mapPath) {
  let root, file, seo, logos, ogFile;
  return {
    name: 'problem-space-map-seo',
    config(c) {
      root = resolve(c.root || process.cwd());
      const loaded = loadMap(root, mapPath);
      file = loaded.file;
      ogFile = resolve(dirname(file), 'og.png');
      seo = renderSeo(loaded.map, { hasOg: existsSync(ogFile) });
      // The logo files that exist for this map, so the page only requests those and draws an initial for the rest.
      const dir = resolve(root, 'public/logos');
      const have = new Set(existsSync(dir) ? readdirSync(dir) : []);
      logos = [...new Set(loaded.map.solutions.map((s) => s.domain + '.png'))].filter((f) => have.has(f)).sort();
      return { define: { __LOGOS__: JSON.stringify(logos) } };
    },
    resolveId(id) {
      if (id === VIRTUAL) return '\0' + VIRTUAL;
    },
    load(id) {
      if (id !== '\0' + VIRTUAL) return;
      this.addWatchFile(file);
      return `export default ${JSON.stringify(loadMap(root, mapPath).map)};`;
    },
    transformIndexHtml(html) {
      return injectSeo(html, seo);
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: seo.robots });
      if (existsSync(ogFile)) this.emitFile({ type: 'asset', fileName: 'og.png', source: readFileSync(ogFile) });
      if (seo.sitemap) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: seo.sitemap });
    },
    // public/ is copied whole; drop other maps' logos from the output.
    writeBundle(opts) {
      const dir = resolve(opts.dir, 'logos');
      if (!existsSync(dir)) return;
      const keep = new Set(logos);
      for (const f of readdirSync(dir)) if (!keep.has(f)) rmSync(resolve(dir, f));
    },
  };
}
