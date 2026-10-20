// Prints a markdown table of a map's solutions (name linked to url, kind, number of tasks).
//   node scripts/products-table.mjs [map.json]            print the table
//   node scripts/products-table.mjs --write README.md     rewrite the README blocks between the markers
// `npm run docs:products` rewrites the README block between <!-- products:start --> and <!-- products:end --> (UX map).
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function productsTable(map) {
  const plural = (n) => n + ' task' + (n === 1 ? '' : 's');
  const order = { product: 0, tool: 1 };
  const rows = [...map.solutions]
    .sort((a, b) => order[a.kind] - order[b.kind] || b.placements.length - a.placements.length || a.name.localeCompare(b.name))
    .map((s) => `| [${s.name.replace(/\|/g, '\\|')}](${s.url}) | ${s.kind === 'tool' ? 'General tool' : 'Product'} | ${plural(s.placements.length)} |`);
  return ['| Solution | Kind | Tasks it serves |', '|---|---|---|', ...rows].join('\n');
}

export function replaceBlock(text, name, body) {
  const start = `<!-- ${name}:start -->`, end = `<!-- ${name}:end -->`;
  const i = text.indexOf(start), j = text.indexOf(end);
  if (i < 0 || j < i) throw new Error(`markers ${start} / ${end} not found`);
  return text.slice(0, i + start.length) + '\n' + body + '\n' + text.slice(j);
}

const BLOCKS = [
  ['products', 'examples/ux-research/map.json'],
];

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
  const args = process.argv.slice(2);
  if (args[0] === '--write') {
    const file = args[1] || 'README.md';
    let text = readFileSync(file, 'utf8');
    for (const [name, map] of BLOCKS) text = replaceBlock(text, name, productsTable(read(map)));
    writeFileSync(file, text);
    console.log(`updated ${file}`);
  } else {
    console.log(productsTable(read(args[0] || 'examples/ux-research/map.json')));
  }
}
