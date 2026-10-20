import { seoPlugin } from './vite/seo-plugin.js';
import { defineConfig, configDefaults } from 'vitest/config';

// The map to build: a path relative to the project root (./ optional) or absolute. The plugin reads and validates
// it, bundles only that map and its logos, and fails the build if the file is missing or invalid.
const MAP_PATH = process.env.MAP || 'examples/ux-research/map.json';

// BASE: URL path the site is served under. OUT_DIR: where the build is written. A nested map (e.g. the TCG example
// at /problem-space-map/tcg/) is built with both; see `npm run build:site`.
const BASE = process.env.BASE || '/problem-space-map/';
const OUT_DIR = process.env.OUT_DIR || 'dist';

export default defineConfig({
  base: BASE,
  build: { outDir: OUT_DIR },
  plugins: [seoPlugin(MAP_PATH)],
  // Playwright owns *.spec.js; vitest runs *.test.js.
  test: { exclude: [...configDefaults.exclude, 'tests/**/*.spec.js'] },
});
