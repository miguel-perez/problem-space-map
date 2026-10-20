# AGENTS.md: making a problem space map

For a coding agent or engineer turning research about a domain into a published map. The page renders one
`map.json`; nothing domain-specific lives in code. What the map shows is in the [README](README.md).

## The rule

Each task needs three measures: its place in the hierarchy, how many people raised it, and their satisfaction
with how it gets done today. **When a measure is missing, derive it, record how in the map's `note`, and tell
the user** what you derived and from what. Never let a derived value pass as measured. Options, best first:
[Getting data short of a full mixed-methods study](#getting-data-short-of-a-full-mixed-methods-study).

## Inputs

| File | Required | Contents |
|---|---|---|
| `groups.csv` | Yes | One row per purpose, goal and task. The [purpose-graphing](https://github.com/miguel-perez/purpose-graphing) skill writes it (step 1). |
| `satisfaction.csv` | No | `group_id,satisfaction`, one row per task, 0–10. Missing tasks default to 5 (height then depends on reach alone; say so in `note`). |
| `solutions.json` | No | An array in the `solutions` shape below. Usually you research it (step 3). |

`groups.csv` columns:

| Column | Meaning |
|---|---|
| `group_id` | Unique id, e.g. `g12`. Becomes the section `id`. |
| `level` | `level1` (task), `level2` (goal) or `level3` (purpose). |
| `label` | The group's name, in people's voice. |
| `parent_id` | Id of the group one level up; empty for purposes. |
| `parent_label` | Parent's label. Ignored. |
| `summaries` | Summaries grouped here. Ignored. |
| `people` | Distinct people who raised it. Sets the footprint. |

Other theme pipelines (affinity maps, a coded spreadsheet) work if they produce the same three levels with a
distinct-people count per group. Write them to these columns, or write `map.json` directly.

## Steps

1. **Get `groups.csv`.** Install the [purpose-graphing](https://github.com/miguel-perez/purpose-graphing) agent
   skill (`npx skills add miguel-perez/purpose-graphing`; Python 3.9+) and run it over people's own words. It
   writes `reports/groups.csv` in exactly the columns above.

2. **Convert.**

   ```sh
   npm run map:from-graph -- \
     --groups path/to/groups.csv \
     --title "Home Bakers Problem Space Map" \
     --out examples/home-bakers/map.json \
     [--description "What home bakers are trying to get done and the products they use."] \
     [--satisfaction path/to/satisfaction.csv] \
     [--solutions path/to/solutions.json] \
     [--levels Purpose,Goal,Task] \
     [--note "How satisfaction and counts were derived."] \
     [--site-url https://example.com/problem-space-map/]
   ```

   - Required: `--groups`, `--title`, `--out`.
   - `--description` defaults to the title. `--levels` names the three levels, top to bottom (default `Purpose,Goal,Task`).
   - The output is validated against the schema; errors name the path of each problem.
   - Keep maps at `examples/<name>/map.json` (recommended). `MAP` also takes `./` paths, absolute paths and other
     folders; a missing or invalid file fails the build.

3. **Research solutions per task.**
   - Prefer what people named in the research. Add well-known ones only if you can say what they do for that task.
   - `use`: one sentence in the person's voice, specific to the task ("Tag interview notes so patterns show across sessions."). Not a product description.
   - `kind: "product"` for software built for the domain; `"tool"` for general software bent to the job (spreadsheets, docs, chat, video calls).
   - `url`: home page. `domain`: hostname the logo is fetched for.
   - Place solutions on tasks (level 1) only.
   - Save to `solutions.json` and re-run step 2 with `--solutions`, or edit `map.json`.

4. **Fetch logos.**

   ```sh
   npm run logos -- examples/home-bakers/map.json
   ```

   Writes `public/logos/<domain>.png` for each new domain: from `data/logos/` if you put one there, else Google's
   favicon service. Exits non-zero listing failures. A missing logo shows the product's initial. Replace a blurry
   favicon with a square PNG, 64 px or larger, under the same name.

5. **Look at it.**

   ```sh
   MAP=examples/home-bakers/map.json npm run dev    # http://localhost:5173/problem-space-map/
   ```

   Check: labels read well in dropdowns and tooltips; no task is overloaded with logos; the tallest blocks make
   sense to someone who knows the domain.

6. **Validate.**

   ```sh
   npm test                                         # schema, model, converter, SEO, docs, examples
   MAP=examples/home-bakers/map.json npm run e2e    # builds that map, loads it in Chromium, checks errors and UI
   ```

   E2E covers one map per run. Run it for each map you change.

7. **Screenshots.** `npm run screenshots` builds both examples and writes `docs/images/*.webp` (UX map, 1600×1000 at
   1.25×, needs `cwebp`) and `og.png` (1200×630 social card) next to each example map. The build ships the chosen
   map's `og.png` and adds the `og:image` tags only when it exists and `siteUrl` is set. Edit `scripts/screenshots.mjs` to point at your map. Look at
   every image: no blank canvas, open menu or stray hover.

8. **Docs.** `npm run docs:products` regenerates the README's products tables. Update the example's `README.md`
   with its source, what was derived, and caveats.

9. **Tell the user** which measures were measured, which were derived, and how.

## map.json schema

`src/schema.js` (zod). Unknown fields are rejected.

```js
{
  title: string,                     // page title and h1
  description: string,               // meta description and social card text
  siteUrl?: string,                  // public http(s) URL ending with /; enables canonical link, og:url, og:image, sitemap, robots.txt Sitemap line
  levels: [string, string, string],  // names for level 3, 2, 1, e.g. ["Purpose", "Goal", "Task"]
  note?: string,                     // how the data was gathered or derived; in the page's crawlable text
  sections: [{
    id: string,                      // unique
    level: 1 | 2 | 3,                // 1 = task, 2 = goal, 3 = purpose
    label: string,
    parent: string | null,           // id of a section exactly one level up; null only for level 3
    people: integer >= 0,            // distinct people who raised it
    satisfaction?: number 0..10      // default 5; only tasks' values are used
  }],
  solutions: [{
    name: string,                    // unique
    kind: "product" | "tool",        // tools are drawn smaller and listed under "General tools"
    url: string,                     // http(s); the "Visit ↗" link
    domain: string,                  // hostname; logo is public/logos/<domain>.png
    placements: [{ section: string /* a level-1 id */, use?: string /* one sentence, shown on hover */ }]
  }]
}
```

Heights (`src/model.js`), per level: rr = people ÷ the most people of any section at that level;
importance = 1 + 9 · rr^0.6; opportunity = importance + max(importance − satisfaction, 0). Goals and purposes
take their children's people-weighted mean satisfaction and are drawn at 0.3× and 0.22× of their opportunity.
Treemap area comes from task `people` only; parents are the sum of their tasks.

## Design rules

- **Neutral palette.** Blocks, floor and UI are cool greys; lower layers darker. Logos are the only colour. Never colour blocks by category or score.
- **Light mode only.**
- **One fixed isometric view.** Pan and zoom only. No rotation or alternative views.
- **Ship only what the map shows.** No quotes, participant ids, segment data, workaround lists or research evidence in `map.json` or the repo. Raw research goes in `data/` (git-ignored).
- **Plain copy.** Labels in people's voice; each `use` is one concrete sentence.
- **Respect `prefers-reduced-motion`** (the fly-to animation already does).

## Publishing

- `MAP` picks the map at build time: `MAP=examples/<name>/map.json npm run build` writes `dist/`. Default: the UX research example.
  Only that map and its logos ship; other maps in the repo stay out of the bundle.
- `BASE` (default `/problem-space-map/`) is the URL path the site is served under; `OUT_DIR` (default `dist`) is where it is written.
- Set `siteUrl` in the map to the public URL, so the canonical link, social card and sitemap point there.

GitHub Pages: set **Settings → Pages → Source** to **GitHub Actions**. `.github/workflows/pages.yml` runs on
push to `main` or manually. It runs `npm ci`, `npm test` (unit tests only; not e2e) and `npm run build:site`, then
deploys `dist/`.

**Several maps in one site.** `npm run build:site` builds the UX map at the site root (`dist/`) and the TCG map under
`dist/tcg/` (`MAP=... BASE=/problem-space-map/tcg/ OUT_DIR=dist/tcg`). Each build emits its own `sitemap.xml`,
`robots.txt` and `og.png`, with its own `siteUrl` for canonical and social tags, so the TCG map's `siteUrl` must end
in `/tcg/`. To ship another map, add one more `MAP=... BASE=... OUT_DIR=dist/<name>` build to the `build:site` script
and set that map's `siteUrl` to match. Links in the README point to each live map.

## Getting data short of a full mixed-methods study

A full study (interviews, then an importance and satisfaction survey) is best. Without one, use the options
below. Record whatever you use in `note`.

### Satisfaction (and importance), best first

1. **ODI importance/satisfaction survey.** People rate each task's importance and their satisfaction with how they do it today. The only measured option.
2. **Per-person satisfaction scored from each person's own statements**, citing the evidence for every score, averaged per task. Directional but traceable. The TCG example uses this.
3. **Pain-language density per group:** share of a group's statements expressing difficulty, frustration or workarounds. Cheap and crude; last resort.
4. **Outside signals** (review ratings, complaint volume, search volume): sense-checks only. They describe products or markets, not tasks.
5. **MaxDiff or Kano** for a forced ranking of importance from a small sample. They rank; they do not measure satisfaction.

### Hierarchy and people counts

Run the [purpose-graphing](https://github.com/miguel-perez/purpose-graphing) skill over any collection of
people's own words: interviews, podcast transcripts, forum threads, reviews, support tickets. It summarises what each person is trying to do in their own voice,
groups the summaries by shared purpose into tasks, goals and purposes, and counts distinct people per group.
Its `groups.csv` export is the converter's input. The TCG example was made this way.

### Tools to gather people's words

Checked 2026-10-20; pricing and features change. Raw-quote sources feed purpose graphing directly.
Pre-clustered tools group pain points across posts and lose per-person counts: use them to find where people
talk, then collect the posts and count people yourself.

| Tool | What it gives you | Fit |
|---|---|---|
| [BuzzAbout](https://buzzabout.ai) | AI social listening across Reddit, TikTok, YouTube, Instagram, X and LinkedIn; extracts pain points; CSV/PDF export, API. Trial, then from $98/mo. | Pre-clustered. Use to discover communities, then re-pull sources. |
| [PainOnSocial](https://painonsocial.com/) | Ranks pain points from chosen subreddits, with quotes and permalinks. $19–$49/mo. | Pre-clustered, but permalinks let you recover authors and count people. |
| [Syften](https://syften.com) | Keyword alerts across Reddit, Hacker News, forums, Stack Exchange, Bluesky, Mastodon and blogs; API, webhook. $29.95–$119.95/mo. | Raw quotes. Good for first-person phrases ("I hate…", "how do I…"). |
| [F5Bot](https://f5bot.com) | Keyword alerts for Reddit, Hacker News and Lobsters; JSON on paid plans. Free tier. | Raw quotes, from now on only (no history). |
| [Brand24](https://www.brand24.com/pricing/) | Mentions across social, Reddit, Quora, YouTube, reviews and podcasts, with history. From $199/mo. | Raw quotes with history; costly for this. |
| [AppFollow](https://appfollow.io) | App store, Steam, Discord, Reddit and Trustpilot reviews; API. Pricing on request. | Raw quotes for app products; skews to bugs and ratings. |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | YouTube captions (`--write-auto-subs`) as VTT/SRT. Free. | Raw words from videos and podcasts; you parse them. |
| [Reddit Data API](https://www.reddit.com/wiki/api/) | Official posts and comments as JSON. Free for non-commercial use only. | Cleanest authors and threads; check current terms. |
| [BuildBetter](https://www.buildbetter.ai) | Reads your own calls, tickets and docs. Demo only. | Your own customers' words; closest to interviews. |

Do not use GummySearch: it closed to new customers in November 2025.

Caveats:

- **Selection bias.** Public complainers are not your users. Heavy users and critics are overrepresented; satisfied people stay quiet. Treat satisfaction from pain language as directional.
- **Duplicate authors.** One person posting in several places inflates counts. Deduplicate by handle before dropping handles.
- **Pre-clustered scores count posts, not people.** Count people yourself in purpose graphing.
- **Terms and privacy.** Follow each platform's API and scraping terms. Publish only aggregated themes and counts, never quotes, handles or permalinks.
