# WC26 Family Quiniela

A mobile-first website that tracks our family's game-by-game predictions for the
FIFA World Cup 2026. Shows each day's fixtures with everyone's predictions and the
points they earned, a **Player of the Day** (top scorer for the day, ties shown as
co-winners), and a running leaderboard with a ⭐ "days won" tally.

## How it's put together

It's a plain static site (HTML/CSS/JS) that reads three JSON files. No server needed
to view it. The scoring is recomputed in the browser every load, so updating a result
is just a matter of updating one JSON file.

```
wc26-quiniela/
├── index.html          Today's fixtures + everyone's predictions + points
├── leaderboard.html    Running standings
├── css/styles.css
├── js/
│   ├── teams.js        Team names + flags (FIFA code -> flag emoji)
│   ├── scoring.js      The scoring engine (pure functions)
│   ├── data.js         Loads JSON, date helpers
│   ├── index.js        Fixtures page
│   └── leaderboard.js  Leaderboard page
├── data/
│   ├── fixtures.json   The 72 group fixtures + knockout round/points metadata  (generated)
│   ├── predictions.json Everyone's picks  (generated)
│   └── results.json    Actual results  (you update this — by hand for now, by API later)
├── assets/logos/       One logo per family member, named <entrant-slug>.png
├── entries/            Each person's completed Excel entry form
└── scripts/ingest.py   Reads entries/*.xlsx -> fixtures.json + predictions.json
```

## Scoring rules

**Group stage** (per match):
| Outcome | Points |
|---|---|
| Exact scoreline | 4 |
| Correct result + correct goal difference | 2 |
| Correct result only | 1 |
| Wrong | 0 |

**Knockout** — points are awarded per round, in a batch, when that round's line-up
becomes known (i.e. the previous round finishes). You score for each team you correctly
predicted to reach that round:
| Round | Points per correct team |
|---|---|
| Round of 32 | 2 |
| Round of 16 | 4 |
| Quarter-final | 6 |
| Semi-final | 9 |
| Finalist | 14 |
| Champion | 25 |

Rounds are scored independently, so a team you back correctly the whole way earns
2+4+6+9+14+25 = 60 points across the tournament.

## Adding family members

1. Drop their completed `WC26 Quiniela Entry Form` (`.xlsx`) into `entries/`.
2. Add their logo to `assets/logos/` named after them, e.g. `jane-smith.png`
   (lower case, spaces and punctuation replaced with hyphens — the slug printed by the
   ingest script).
3. Re-run the ingest:
   ```
   python3 scripts/ingest.py
   ```
   It rebuilds `predictions.json` (and `fixtures.json`). Logos that aren't present yet
   just show a blank circle until you add them.

## Updating results

There are three layers, and they merge so manual fixes always win:

| File | What it is | Who writes it |
|---|---|---|
| `data/results.base.json` | Pure API layer | the fetcher |
| `data/overrides.json` | Manual corrections (always win) | the admin page (or you, by hand) |
| `data/results.json` | What the site reads = base + overrides | the fetcher / admin |

### Automatic (API-Football)

Get a free key at <https://www.api-football.com> (dashboard → API key), then:

```
API_FOOTBALL_KEY=your_key node scripts/fetch-results.js          # write results
API_FOOTBALL_KEY=your_key node scripts/fetch-results.js --dry-run # preview only
```

It pulls World Cup 2026 fixtures, maps finished matches to our fixture ids (matching on
team names, with aliases for the awkward ones like "South Korea" → KOR), works out which
teams reached each knockout round, layers your overrides on top, and writes
`results.json`. Any fixture it can't map is printed so you can add an alias in
`scripts/fetch-results.js` (`NAME_ALIASES`).

Once deployed, the included GitHub Action (`.github/workflows/fetch-results.yml`) runs
this every 20 minutes and commits the result, so points refresh a few minutes after full
time with no effort. (Add `API_FOOTBALL_KEY` as a repo secret and give Actions write
permission — see the comments in that file.)

### Manual entry / corrections (admin page)

```
node scripts/admin-server.js
# then open http://localhost:8123/admin.html
```

A friendly editor: step through matchdays and type final scores (flag + 3-letter code per
team), or fix a knockout round's line-up. Saving writes `overrides.json` and regenerates
`results.json` instantly. Use it to enter results before you've set up the API, or to
correct the rare API miss. After editing, commit & push to update the live site.

You can also just hand-edit `data/overrides.json` if you prefer.

## Viewing locally

```
python3 -m http.server 8099        # then open http://localhost:8099
# (or use the admin server, which also serves the site, on :8123)
```

## Still to do

- **Load the rest of the family** — drop each `.xlsx` in `entries/`, add logos, re-run
  `ingest.py`.
- **Deploy** — push to Netlify / Vercel / GitHub Pages and wire up the Action secret.
