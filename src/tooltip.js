// Hover tooltip: a solution's name, kind and what people do with it on this task; a section's parent trail,
// full name, level and people count. It follows the pointer over the map.
export const el = (tag, cls = '', text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

// A logo image that hides itself if the file is missing.
export const logoImg = (src) => {
  const i = el('img');
  i.alt = '';
  i.addEventListener('error', () => { i.hidden = true; });
  i.src = src;
  return i;
};

export const peopleTxt = (n) => (n === 1 ? '1 person' : n + ' people');

// levelName(level) gives the map's name for a level ("Purpose", "Goal", "Task").
export function createTooltip(stage, { sections, levelName, logoUrl }) {
  const tip = el('div', 'tip');
  tip.setAttribute('role', 'tooltip');
  stage.append(tip);
  let tipFor = null, pointer = null;

  function place() {
    if (!pointer || !tipFor) return;
    // Sit below and right of the pointer, flipping to stay inside the window.
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = pointer.x + 16, y = pointer.y + 18;
    if (x + w > innerWidth - 8) x = pointer.x - w - 12;
    if (y + h > innerHeight - 8) y = pointer.y - h - 12;
    tip.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
  }

  // info: what the pointer is over (or null); hidden: true while a menu is open.
  function show(info, hidden) {
    const h = pointer && info;
    if (h !== tipFor) {
      tipFor = h;
      tip.replaceChildren();
      if (h && h.kind === 'solution') {
        const name = el('div', 'name');
        const src = logoUrl(h.sol.domain);
        if (src) name.append(logoImg(src));
        name.append(el('span', '', h.sol.name), el('span', 'kind', h.sol.kind === 'tool' ? 'General tool' : 'Product'));
        tip.append(name);
        if (h.use) tip.append(el('div', 'use', h.use));
      } else if (h) {
        const trail = [];
        for (let x = h.g.parent && sections.get(h.g.parent); x; x = x.parent && sections.get(x.parent)) trail.unshift(x.label);
        if (trail.length) tip.append(el('div', 'trail', trail.join(' › ')));
        tip.append(el('div', 'name', h.g.label), el('div', 'meta', levelName(h.g.level) + ' · ' + peopleTxt(h.g.people)));
      }
    }
    tip.classList.toggle('on', !!h && !hidden);
    place();
  }

  return {
    show,
    move(p) { pointer = p; place(); },
  };
}
