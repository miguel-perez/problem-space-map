// Navigation: one dropdown per level (purpose, goal, task), always shown. Each lists the sections at its level
// inside whatever is chosen above it; a separate dropdown at the right pins a solution.
import { el, logoImg } from './tooltip.js';
import { solutionKey } from './solutions.js';

const caret = () => {
  const t = document.createElement('template');
  t.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return t.content.firstChild;
};
// "Visit <name> ↗": opens the product's site in a new tab. It never changes the map's selection.
const visitLink = (sol, cls = 'visit') => {
  const a = el('a', cls, 'Visit ↗');
  a.href = sol.url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.setAttribute('aria-label', 'Visit ' + sol.name + ' (opens in a new tab)');
  a.addEventListener('click', (e) => e.stopPropagation());
  return a;
};
const plural = (n, one) => n + ' ' + one + (n === 1 ? '' : 's');

// state: { selected, pinned }; select(id) and pin(key) act on the map and call render() again.
export function createNav(nav, { map, sections, family, levelName, logoUrl, state, select, pin }) {
  let openMenu = null;
  const lower = (level) => levelName(level).toLowerCase();

  function close(refocus = false) {
    if (!openMenu) return;
    openMenu.menu.classList.remove('open');
    openMenu.btn.setAttribute('aria-expanded', 'false');
    if (refocus) openMenu.btn.focus();
    openMenu = null;
  }

  function step(label, items, o = {}) {
    const wrap = el('div', ['crumb', o.current && 'cur', o.muted && 'muted', o.product && 'product'].filter(Boolean).join(' '));
    const btn = el('button');
    btn.type = 'button';
    btn.title = o.title || label;
    if (o.img) btn.append(logoImg(o.img));
    btn.append(el('span', '', label));
    wrap.append(btn);
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
    btn.append(caret());
    const menu = el('div', 'menu');
    menu.setAttribute('role', 'menu');
    items.forEach((it) => {
      if (it.head) { menu.append(el('div', 'menu-head', it.head)); return; }
      const b = el('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      if (it.current) b.setAttribute('aria-current', 'true');
      if (it.img) b.append(logoImg(it.img));
      b.append(el('span', '', it.label));
      if (it.meta) b.append(el('span', 'meta', it.meta));
      b.addEventListener('click', () => { close(); it.act(); });
      if (it.visit) {
        const row = el('div', 'menu-row');
        row.append(b, visitLink(it.visit, 'visit'));
        menu.append(row);
      } else menu.append(b);
    });
    menu.addEventListener('keydown', (e) => {
      const bs = [...menu.querySelectorAll('button, a')], i = bs.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        bs[(i + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length].focus();
      }
    });
    wrap.append(menu);
    btn.addEventListener('click', () => {
      const was = openMenu && openMenu.btn === btn;
      close();
      if (was) return;
      // Open under the button, nudged sideways as needed to stay 16px inside the window.
      menu.style.left = '0px';
      menu.classList.add('open');
      const r = menu.getBoundingClientRect();
      let dx = Math.min(0, innerWidth - 16 - r.right);
      if (r.left + dx < 16) dx = 16 - r.left;
      menu.style.left = dx + 'px';
      btn.setAttribute('aria-expanded', 'true');
      openMenu = { menu, btn };
      (menu.querySelector('[aria-current]') || menu.querySelector('button')).focus();
    });
    return wrap;
  }

  const all = [...sections.values()];
  const byName = (a, b) => a.name.localeCompare(b.name);
  const products = map.solutions.filter((s) => s.kind === 'product').sort(byName);
  const tools = map.solutions.filter((s) => s.kind === 'tool').sort(byName);
  const solByKey = new Map(map.solutions.map((s) => [solutionKey(s), s]));

  function render() {
    close();
    const sel = state.selected && sections.get(state.selected);
    const at = {};
    for (let x = sel; x; x = x.parent && sections.get(x.parent)) at[x.level] = x;
    const parts = [];
    [3, 2, 1].forEach((level) => {
      // The choices: every section at this level inside the nearest section chosen above it.
      const above = at[level + 1] || at[level + 2];
      const options = (above ? [...family(above)] : all).filter((g) => g.level === level);
      const g = at[level];
      const items = options.map((o) => ({ label: o.label, current: o === g, act: () => select(o.id) }));
      // Choosing "Any" steps the selection back up to the level above.
      if (g) items.unshift({ label: 'Any ' + lower(level), act: () => select(above ? above.id : null) });
      parts.push(step(g ? g.label : levelName(level), items,
        { current: g === sel && !!g, muted: !g, title: g ? levelName(level) + ': ' + g.label : 'Choose a ' + lower(level) }));
    });
    const key = state.pinned, pc = key && solByKey.get(key);
    const sols = [];
    if (key) sols.push({ label: 'Clear solution', act: () => pin(null) });
    // Specialist products first, then general-purpose tools people bend to the job.
    const item = (s) => ({ visit: s, label: s.name, img: logoUrl(s.domain), meta: plural(s.placements.length, lower(1)),
      current: key === solutionKey(s), act: () => pin(solutionKey(s)) });
    if (products.length) sols.push({ head: 'Products' }, ...products.map(item));
    if (tools.length) sols.push({ head: 'General tools' }, ...tools.map(item));
    const crumb = step(pc ? pc.name : 'Solutions', sols, { product: true, current: !!pc, muted: !pc, img: pc && logoUrl(pc.domain) });
    parts.push(crumb);
    if (pc) parts.push(visitLink(pc, 'visit pinned'));
    nav.replaceChildren(...parts);
  }

  document.addEventListener('pointerdown', (e) => { if (openMenu && !e.target.closest('.crumb')) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') close(true); });

  return { render, isOpen: () => !!openMenu };
}
