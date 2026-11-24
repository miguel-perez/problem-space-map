# Card game ecosystem example

**[Open the live map →](https://miguel.design/problem-space-map/tcg/)**

What people who play, collect, sell, make and work around card games are trying to get done. Run it with
`MAP=examples/tcg-ecosystem/map.json npm run dev`.

Unlike the [TCG players example](../tcg-players/README.md) (10 people, mostly Digimon podcast hosts), this map is
built from a large public corpus and covers the trade as well as the players.

| | |
|---|---|
| Hierarchy | 210 tasks, 64 goals, 16 purposes, from a purpose graph of 1,444 first-level groups. Only tasks raised by 4+ people are shown. |
| People | 1,605 accounts and 6,346 summaries: public posts and videos (Reddit, YouTube, note.com, X, LinkedIn, TikTok and others) plus five interviews. Players of 28 card games, shop owners and staff, sellers, retail employees, makers, artists, designers, teachers, partners and parents. |
| Satisfaction | **Scored, not measured.** A model read every account under each task and scored each person 0 to 10 on how well the task goes for them, from that person's own statements, recording the statement behind each score (2,890 scores; option 2 in [AGENTS.md](../../AGENTS.md)). A task shows the mean. 440 scores are a neutral 5 because the person's statements do not say how it goes. |
| Solutions | 78 products and tools on 79 of 210 tasks (142 placements, at most four a task). These are what people in each task say they use, pay or turn to, read from their accounts; four well-known products were added where no one named them (TCGplayer, Pokémon TCG Live, Pirate Ship, Scryfall on one task each). Each sentence is a model's, in the person's voice. |

## Caveats

- **Model readings throughout.** Summaries, grouping, review and the product sentences were made by models. Nothing was checked by a person.
- **Counts are of who was heard, not of who exists.** Accounts were found by search in particular communities, so footprint shows where this corpus is deep (Magic and Pokémon; buying and selling) more than where the population is.
- **Most products rest on one person.** People name few products in recounted moments: 131 tasks show none, and most placements come from a single account. An empty task is not evidence of an empty market.
- **Left out on purpose.** The card games themselves, generic objects (binders, sleeves, starter decks), single local shops and about 30 names whose home page could not be stated with confidence. Six logos could not be fetched and show an initial.
- **Workarounds are not in the map.** 940 were read from the accounts, on 199 tasks (printing stand-in cards, going without, asking a friend). They stay with the research data and are not shipped here, as [AGENTS.md](../../AGENTS.md) asks.
- **The trade is thinner than the players.** Distributors and payment firms are one former employee each; regulators, import services and tour providers appear only as described by others.

## Files

| File | What it is |
|---|---|
| `groups.csv` | Purposes, goals and tasks with counts of summaries and people, exported from the research purpose graph. |
| `satisfaction.csv` | One score per task: the mean of the per-person scores. |
| `solutions.json` | Products and tools with one sentence per task. |
| `map.json` | `npm run map:from-graph` output from the three files above. The only file the page reads. |
| `og.png` | Social card for the live page. |

Source: the TCG sandbox of the ai-accelerator repository (grouping `tcg-corpus-v7`), 2026-11-24.

Logos: `npm run logos -- examples/tcg-ecosystem/map.json`.
