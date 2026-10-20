import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseMap } from '../src/schema.js';
import { renderSeo, injectSeo } from '../vite/seo-plugin.js';

const map = parseMap(JSON.parse(readFileSync('examples/ux-research/map.json', 'utf8')));
const seo = renderSeo(map, { hasOg: true });
const html = seo.head + seo.body;

test('has one h1 equal to title', () => {
  const h1s = seo.body.match(/<h1[ >]/g) || [];
  expect(h1s).toHaveLength(1);
  expect(seo.body).toContain(`<h1>${map.title.replace(/&/g, '&amp;')}</h1>`);
  expect(seo.body).toContain('<section class="sr-only" id="about">');
});

test('lists all tasks', () => {
  const tasks = map.sections.filter((s) => s.level === 1);
  expect(tasks.length).toBe(60);
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  for (const t of tasks) expect(seo.body).toContain(esc(t.label));
});

test('every solution link uses its url', () => {
  for (const s of map.solutions) expect(seo.body).toContain(`href="${s.url.replace(/&/g, '&amp;')}"`);
});

test('JSON-LD parses', () => {
  const m = seo.head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  const ld = JSON.parse(m[1]);
  expect(ld['@type']).toEqual(['WebPage', 'Dataset']);
  expect(ld.name).toBe(map.title);
  expect(ld.creator.name).toBe('Miguel Perez');
  expect(ld.license).toBe('https://creativecommons.org/licenses/by/4.0/');
});

test('head has canonical, og and twitter tags; sitemap and note present', () => {
  expect(seo.head).toContain(`<link rel="canonical" href="${map.siteUrl}">`);
  expect(seo.head).toContain(`<meta property="og:image" content="${map.siteUrl}og.png">`);
  expect(seo.head).toContain('<meta name="twitter:card" content="summary_large_image">');
  expect(seo.sitemap).toContain(`<loc>${map.siteUrl}</loc>`);
  expect(seo.body).toContain(map.note.replace(/&/g, '&amp;'));
});

test('no og:image or twitter:image without an og.png', () => {
  const out = renderSeo(map);
  expect(out.head).not.toMatch(/og:image|twitter:image/);
  expect(out.head).toContain('og:title');
});

test('escapes text and omits siteUrl things gracefully', () => {
  const m = { ...map, title: 'A & <B> "q"', siteUrl: undefined };
  const out = renderSeo(m);
  expect(out.head + out.body).not.toContain('<B>');
  expect(out.body).toContain('<h1>A &amp; &lt;B&gt; &quot;q&quot;</h1>');
  expect(out.head).toContain('A &amp; &lt;B&gt;');
  expect(out.head).not.toContain('canonical');
  expect(out.head).not.toContain('og:url');
  expect(out.sitemap).toBe('');
});

test('injection keeps $-patterns in map text literal', () => {
  const out = renderSeo({ ...map, title: "Cost $& $' $$ map" });
  const html = injectSeo('<head><title>x</title><!-- seo:head --></head><body><!-- seo:body --></body>', out);
  expect(html).toContain("<h1>Cost $&amp; $&#39; $$ map</h1>");
  expect(html).not.toContain('<!-- seo');
});

test('robots.txt derives from siteUrl; keywords are not hard-coded', () => {
  expect(seo.robots).toContain(`Sitemap: ${map.siteUrl}sitemap.xml`);
  expect(seo.head).not.toContain('jobs to be done');
});
