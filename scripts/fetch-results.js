#!/usr/bin/env node
/**
 * WC26 Quiniela — results fetcher.
 *
 * Pulls World Cup 2026 fixtures from football-data.org (free tier), maps finished
 * matches to our fixture ids, derives which teams reached each knockout round,
 * layers data/overrides.json on top (manual fixes always win), and writes
 * data/results.json.
 *
 * Usage:
 *   FOOTBALL_DATA_KEY=xxxxx node scripts/fetch-results.js
 *   FOOTBALL_DATA_KEY=xxxxx node scripts/fetch-results.js --dry-run
 *
 * Free key: https://www.football-data.org
 */
const fs = require("fs");
const path = require("path");
const { mergeResults } = require("./merge");

const DATA = path.join(__dirname, "..", "data");
const DRY = process.argv.includes("--dry-run");
const KEY = process.env.FOOTBALL_DATA_KEY;

// football-data.org stage -> our round id
function roundIdFromStage(stage) {
  switch ((stage || "").toUpperCase()) {
    case "LAST_32":        return "R32";
    case "LAST_16":        return "R16";
    case "QUARTER_FINALS": return "QF";
    case "SEMI_FINALS":    return "SF";
    case "FINAL":          return "F";
    case "THIRD_PLACE":    return null; // not scored
    default:               return null;
  }
}

// Walk the static bracket to resolve a side's team code from knockoutStage scores.
// pens = knockoutPens map (optional) — used to pick the correct winner when AET ends level.
function resolveTeamCode(side, fixtures, scores, pens, depth) {
  if (side.code) return side.code;
  if (!side.sourceMatch || (depth || 0) > 5) return null;
  const src = (fixtures.knockoutFixtures || []).find((f) => f.id === side.sourceMatch);
  if (!src) return null;
  const score = scores[src.id];
  if (!score || score[0] == null) return null;
  const h = resolveTeamCode(src.home, fixtures, scores, pens, (depth || 0) + 1);
  const a = resolveTeamCode(src.away, fixtures, scores, pens, (depth || 0) + 1);
  if (score[0] === score[1]) {
    if (!pens) return null;
    const p = pens[src.id];
    if (!p) return null; // draw but pen data not yet available — treat as unsettled
    return p[0] > p[1] ? h : a;
  }
  return score[0] > score[1] ? h : a;
}

function normalize(s) {
  return (s || "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8"));
}

function buildLookup(fixtures) {
  const byTla  = {};
  const byName = {};
  for (const f of fixtures.groupStage) {
    for (const side of [f.home, f.away]) {
      byTla[side.code.toLowerCase()]  = side.code;
      byName[normalize(side.name)]    = side.code;
    }
  }
  return { byTla, byName };
}

function codeFor(team, lookup) {
  return lookup.byTla[(team.tla || "").toLowerCase()]
      || lookup.byName[normalize(team.name)]
      || lookup.byName[normalize(team.shortName)]
      || null;
}

async function apiGet(url) {
  const res = await fetch(url, { headers: { "X-Auth-Token": KEY } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${url} -> ${res.status} ${res.statusText}: ${body}`);
  }
  return res.json();
}

async function main() {
  if (!KEY) {
    console.error("Missing FOOTBALL_DATA_KEY. Get a free key at https://www.football-data.org");
    process.exit(1);
  }

  const fixtures  = loadJson("fixtures.json");
  const overrides = loadJson("overrides.json");
  const lookup    = buildLookup(fixtures);

  const pairIndex = {};
  for (const f of fixtures.groupStage) {
    const key = [f.home.code, f.away.code].sort().join("|");
    pairIndex[key] = { id: f.id, homeCode: f.home.code };
  }

  console.log("Fetching World Cup 2026 matches from football-data.org...");
  const data = await apiGet("https://api.football-data.org/v4/competitions/WC/matches?season=2026");
  const matches = data.matches || [];
  console.log(`  ${matches.length} matches returned.`);

  const base    = { groupStage: {}, knockoutStage: {}, knockoutPens: {}, knockout: { R32: [], R16: [], QF: [], SF: [], F: [], WINNER: null } };
  // penWinners: fixtureId -> winning team code, populated during match processing,
  // used in the advancement loop so draws (penalty matches) pick the correct team.
  const penWinners = {};
  const unmatched = [];

  // Build kickoff-time lookup for static KO fixtures (ms since epoch → fixture id).
  const koKickoffMap = {};
  for (const kofx of (fixtures.knockoutFixtures || [])) {
    if (kofx.kickoff) koKickoffMap[new Date(kofx.kickoff).getTime()] = kofx.id;
  }

  // Fallback: team-code pair lookup for R32 fixtures (codes are known at draw time).
  const koTeamPairMap = {};
  for (const kofx of (fixtures.knockoutFixtures || []).filter(f => f.round === "R32")) {
    if (kofx.home.code && kofx.away.code) {
      const key = [kofx.home.code, kofx.away.code].sort().join("|");
      koTeamPairMap[key] = kofx.id;
    }
  }

  // Process all matches sorted by date so earlier results are available when resolving later ones.
  matches.sort((a, b) => (a.utcDate || "").localeCompare(b.utcDate || ""));

  for (const m of matches) {
    const homeCode = codeFor(m.homeTeam, lookup);
    const awayCode = codeFor(m.awayTeam, lookup);
    const stage    = m.stage;
    const koRound  = roundIdFromStage(stage);
    const finished = m.status === "FINISHED";

    if (!homeCode || !awayCode) {
      if (koRound) {
        console.log(`  ! KO code lookup failed: ${m.homeTeam.name}(tla=${m.homeTeam.tla}) v ${m.awayTeam.name}(tla=${m.awayTeam.tla}) [${stage}]`);
      }
      unmatched.push(`${m.homeTeam.name} v ${m.awayTeam.name} (${stage})`);
      continue;
    }

    if (koRound) {
      if (!finished) {
        console.log(`  ~ KO not finished: ${m.homeTeam.name} v ${m.awayTeam.name} (${m.status}) ${m.utcDate}`);
        continue;
      }

      // For penalty shootouts the API stores the cumulative (AET + penalty goals) total in
      // score.fullTime. Use score.extraTime for the actual goals-in-play tally, and capture
      // the penalty count separately so the UI can display "Paraguay win 5-4 on pens".
      const isPen = m.score?.duration === "PENALTY_SHOOTOUT";
      const penScore = m.score?.penalties;
      const extTime  = m.score?.extraTime;
      let gh, ga;
      if (isPen && penScore && penScore.home != null && penScore.away != null) {
        if (extTime && extTime.home != null && extTime.away != null) {
          // extraTime = score at the end of ET (before penalties) — this is what we display.
          gh = extTime.home;
          ga = extTime.away;
        } else {
          // Fallback: subtract penalty goals from the inflated fullTime total.
          gh = (m.score?.fullTime?.home ?? 0) - penScore.home;
          ga = (m.score?.fullTime?.away ?? 0) - penScore.away;
        }
      } else {
        gh = m.score?.fullTime?.home;
        ga = m.score?.fullTime?.away;
      }
      if (gh == null || ga == null) continue;

      // Match to our static fixture: try kickoff timestamp first, fall back to team codes.
      const kickoffMs = m.utcDate ? new Date(m.utcDate).getTime() : null;
      let fixtureId = kickoffMs ? koKickoffMap[kickoffMs] : null;
      if (!fixtureId && homeCode && awayCode) {
        const pairKey = [homeCode, awayCode].sort().join("|");
        fixtureId = koTeamPairMap[pairKey] || null;
        if (fixtureId) console.log(`  ~ KO matched by team codes (timestamp mismatch): ${m.homeTeam.name} v ${m.awayTeam.name} ${m.utcDate}`);
      }

      if (fixtureId) {
        // Store score in the right home/away orientation for our static fixture.
        const kofx = fixtures.knockoutFixtures.find((f) => f.id === fixtureId);
        const staticHome = resolveTeamCode(kofx.home, fixtures, base.knockoutStage, base.knockoutPens);
        const homeIsHome = staticHome === homeCode || staticHome === null;
        base.knockoutStage[fixtureId] = homeIsHome ? [gh, ga] : [ga, gh];

        if (isPen && penScore && penScore.home != null) {
          const ph = homeIsHome ? penScore.home : penScore.away;
          const pa = homeIsHome ? penScore.away : penScore.home;
          base.knockoutPens[fixtureId] = [ph, pa];
          // Track the winner by team code so the advancement loop can pick correctly.
          const w = m.score?.winner;
          if (w === "HOME_TEAM") penWinners[fixtureId] = homeIsHome ? homeCode : awayCode;
          else if (w === "AWAY_TEAM") penWinners[fixtureId] = homeIsHome ? awayCode : homeCode;
        }
      } else {
        console.log(`  ! KO result not matched to fixture: ${m.homeTeam.name} v ${m.awayTeam.name} ${m.utcDate}`);
      }

      if (stage === "FINAL") {
        const w = m.score?.winner;
        if (w === "HOME_TEAM") base.knockout.WINNER = homeCode;
        else if (w === "AWAY_TEAM") base.knockout.WINNER = awayCode;
      }
    } else {
      // Group stage — record finished scores.
      if (!finished) continue;
      const gh = m.score?.fullTime?.home;
      const ga = m.score?.fullTime?.away;
      if (gh != null && ga != null) {
        const key = [homeCode, awayCode].sort().join("|");
        const hit = pairIndex[key];
        if (!hit) { unmatched.push(`${m.homeTeam.name} v ${m.awayTeam.name} (no group fixture)`); continue; }
        base.groupStage[hit.id] = hit.homeCode === homeCode ? [gh, ga] : [ga, gh];
      }
    }
  }

  // Derive knockout advancement arrays from static bracket + scores.
  // R32 = all 32 teams in the bracket (from the static fixtures).
  const koSets = { R32: new Set(), R16: new Set(), QF: new Set(), SF: new Set(), F: new Set() };
  for (const kofx of (fixtures.knockoutFixtures || []).filter((f) => f.round === "R32")) {
    if (kofx.home.code) koSets.R32.add(kofx.home.code);
    if (kofx.away.code) koSets.R32.add(kofx.away.code);
  }
  // Advancement: winner of each match reaches the next round.
  // Use penWinners for penalty matches (score is level at AET).
  const roundNext = { R32: "R16", R16: "QF", QF: "SF", SF: "F" };
  for (const kofx of (fixtures.knockoutFixtures || [])) {
    const score = base.knockoutStage[kofx.id];
    if (!score) continue;
    const h = resolveTeamCode(kofx.home, fixtures, base.knockoutStage, base.knockoutPens);
    const a = resolveTeamCode(kofx.away, fixtures, base.knockoutStage, base.knockoutPens);
    // If scores are level, only advance the pen winner — never fall back to home team
    // (that caused a temporary incorrect advancement before pen data arrives from the API).
    let winner;
    if (score[0] > score[1]) winner = h;
    else if (score[0] < score[1]) winner = a;
    else winner = penWinners[kofx.id] || null;
    const next = roundNext[kofx.round];
    if (next && winner) koSets[next].add(winner);
  }
  for (const r of ["R32", "R16", "QF", "SF", "F"]) {
    base.knockout[r] = Array.from(koSets[r]).sort();
  }

  const merged = mergeResults(base, overrides);
  merged.lastUpdated = new Date().toISOString();
  merged.note = "Auto-generated by fetch-results.js (football-data.org + overrides.json). Do not hand-edit; use admin page or overrides.json.";

  console.log(`  Group results: ${Object.keys(merged.groupStage).length}/72 final.`);
  console.log(`  KO results: ${Object.keys(merged.knockoutStage).length} matches settled.`);
  console.log(`  Knockout reached: ` +
    ["R32","R16","QF","SF","F"].map(r => `${r}=${merged.knockout[r].length}`).join(" ") +
    ` WINNER=${merged.knockout.WINNER || "-"}`);
  if (unmatched.length) {
    console.log(`  ! ${unmatched.length} unmatched fixture(s):`);
    for (const u of unmatched.slice(0, 20)) console.log(`      ${u}`);
  }

  if (DRY) { console.log("\n--dry-run: not writing files"); return; }

  fs.writeFileSync(path.join(DATA, "results.base.json"),  JSON.stringify(base,   null, 2));
  fs.writeFileSync(path.join(DATA, "results.json"),       JSON.stringify(merged, null, 2));
  console.log("\nWrote data/results.json (+ results.base.json). fixtures.json unchanged.");
}

main().catch(e => { console.error(e.message); process.exit(1); });
