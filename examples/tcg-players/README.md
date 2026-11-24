# TCG players example

Run it with `MAP=examples/tcg-players/map.json npm run dev`. The live map at `/tcg/` is now the larger [card game ecosystem example](../tcg-ecosystem/README.md).

What trading card game players, mostly Digimon TCG, are trying to get done. Run it with
`MAP=examples/tcg-players/map.json npm run dev`.

| | |
|---|---|
| Hierarchy | 57 tasks, 16 goals, 5 purposes, from the [purpose-graphing](https://github.com/miguel-perez/purpose-graphing) skill. Only themes raised by 2+ people. |
| People | 10 participants: 5 interviews, 5 Digimon TCG podcast hosts |
| Satisfaction | Scored 0–10 from each participant's statements by an AI-assisted analysis pipeline. An estimate, not a survey. |
| Solutions | 14 that participants named, each with one sentence per task it serves |

## Caveats

- **Podcast-host heavy.** Hosts produced most of the statements, so the map leans toward competitive players and on-air topics.
- **Small n.** Read people counts as a rough signal, not a share of players.
- **Derived satisfaction.** Model-scored from what people said.

## Files

| File | What it is |
|---|---|
| `tests/fixtures/tcg/groups.csv` | Purpose-graphing export: labels, levels, counts of summaries and people. |
| `tests/fixtures/tcg/satisfaction.csv` | One satisfaction score per task. |
| `solutions.json` | Products. Placements were moved from their original theme to the task it falls under; duplicates on one task were merged, keeping the first sentence. |
| `map.json` | `npm run map:from-graph` output from the three files above. The only file the page reads. |

Logos: `npm run logos -- examples/tcg-players/map.json`.

Data license: CC BY 4.0.
