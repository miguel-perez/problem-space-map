import { test, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

test('every file in public/logos is a real PNG', () => {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const files = readdirSync('public/logos');
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) {
    expect(readFileSync(`public/logos/${f}`).subarray(0, 8).equals(sig), f).toBe(true);
  }
});
