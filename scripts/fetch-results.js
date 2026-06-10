#!/usr/bin/env node
/**
 * WC26 Quiniela — results fetcher.
 *
 * Pulls World Cup 2026 fixtures from API-Football (free tier), maps finished
 * matches to our fixture ids, derives which teams reached each knockout round,
 * layers data/overrides.json on top (manual fixes always win), and writes
 * data/results.json.
 *
 * Usage:
 *   API_FOOTBALL_KEY=xxxxx node scripts/fetch-results.js
 *   API_FOOTBALL_KEY=xxxxx node scripts/fetch-results.js --dry-run   # print, don't write
 *
 * Free key: https://www.api-football.com  (dashboard -> API key).
 * World Cup is league id 1; season 2026.
 *
 * Matching is by team-name aliases (API names differ from FIFA names, e.g.
 * "South Korea" vs "Korea Republic"). Any fixture we can't map is logged so you
 * can add an alias below or fix it in the admin page.
 */
const fs = require("fs");
const path = require("path");
const { mergeResults } = require("./merge");

const DATA = path.join(__dirname, "..", "data");
const DRY = process.argv.includes("--dry-run");
const KEY = process.env.API_FOOTBALL_KEY;
const LEAGUE = 1;          // FIFA World Cup
const SEASON = 2026;
const HOST = "v3.football.api-sports.io";

// API-Football team name (normalised) -> our FIFA code, only where they differ
// from our names in teams/fixtures. Everything else matches on the plain name.
const NAME_ALIASES = {
  "south korea": "KOR",
  "korea republic": "KOR",
  "czech republic": "CZE",
  "czechia": "CZE",
  "ivory coast": "CIV",
  "cote divoire": "CIV",
  "turkey": "TUR",
  "turkiye": "TUR",
  "dr congo": "COD",
  "congo dr": "COD",
  "cape verde islands": "CPV",
  "cape verde": "CPV",
  "usa": "USA",
  "united states": "USA",
  "bosnia and herzegovina": "BIH",
  "bosnia": "BIH",
  "south africa": "RSA",
  "saudi arabia": "KSA",
};

// API-Football "round" label (lowercased) -> our knockout round id.
function roundIdFromLabel(label) {
  const l = (label || "").toLowerCase();
  if (l.includes("round of 32")) return "R32";
  if (l.includes("round of 16")) return "R16";
  if (l.includes("quarter")) return "QF";
  if (l.includes("semi")) return "SF";
  if (l.includes("final") && !l.includes("semi") && !l.includes("quarter")) return "F"; // Final / 3rd place
  return null;
}

const FINISHED = new Set(["FT", "AET", "PEN"]);

function normalize(s) {
  return (s || "")
    .normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA, name), "utf8"));
}

function buildNameToCode(fixtures) {
  // From our own fixtures: normalised team name -> code.
  const map = {};
  for (const f of fixtures.groupStage) {
    map[normalize(f.home.name)] = f.home.code;
    map[normalize(f.away.name)] = f.away.code;
  }
  // Overlay aliases.
  for (const k of Object.keys(NAME_ALIASES)) map[normalize(k)] = NAME_ALIASES[k];
  return map;
}

function codeFor(apiName, nameToCode) {
  return nameToCode[normalize(apiName)] || null;
}

async function apiGet(p) {
  const res = await fetch(`https://${HOST}${p}`, {
    headers: { "x-apisports-key": KEY },
  });
  if (!res.ok) throw new Error(`API ${p} -> ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length) {
    throw new Error(`API ${p} errors: ${JSON.stringify(json.errors)}`);
  }
  return json.response || [];
}

async function main() {
  if (!KEY) {
    console.error("Missing API_FOOTBALL_KEY. Get a free key at https://www.api-football.com");
    process.exit(1);
  }

  const fixtures = loadJson("fixtures.json");
  const overrides = loadJson("overrides.json");
  const nameToCode = buildNameToCode(fixtures);

  // Index our group fixtures by unordered team-code pair -> {id, homeCode}.
  const pairIndex = {};
  for (const f of fixtures.groupStage) {
    const key = [f.home.code, f.away.code].sort().join("|");
    pairIndex[key] = { id: f.id, homeCode: f.home.code };
  }

  console.log(`Fetching World Cup ${SEASON} fixtures...`);
  const apiFixtures = await apiGet(`/fixtures?league=${LEAGUE}&season=${SEASON}`);
  console.log(`  ${apiFixtures.length} fixtures returned.`);

  const base = { groupStage: {}, knockout: { R32: [], R16: [], QF: [], SF: [], F: [], WINNER: null } };
  const koSets = { R32: new Set(), R16: new Set(), QF: new Set(), SF: new Set(), F: new Set() };
  const unmatched = [];

  for (const fx of apiFixtures) {
    const status = fx.fixture?.status?.short;
    const homeName = fx.teams?.home?.name;
    const awayName = fx.teams?.away?.name;
    const homeCode = codeFor(homeName, nameToCode);
    const awayCode = codeFor(awayName, nameToCode);
    const gh = fx.goals?.home;
    const ga = fx.goals?.away;
    const roundLabel = fx.league?.round;
    const koRound = roundIdFromLabel(roundLabel);

    if (!homeCode || !awayCode) {
      unmatched.push(`${homeName} v ${awayName} (${roundLabel})`);
      continue;
    }

    if (koRound) {
      // Both teams "reached" this round just by playing in it.
      koSets[koRound].add(homeCode);
      koSets[koRound].add(awayCode);
      // Champion = winner of the Final (exclude 3rd-place playoff).
      if (koRound === "F" && /(^|[^a-z])final([^a-z]|$)/i.test(roundLabel || "") &&
          !/3rd|third|place/i.test(roundLabel || "") && FINISHED.has(status)) {
        if (fx.teams?.home?.winner) base.knockout.WINNER = homeCode;
        else if (fx.teams?.away?.winner) base.knockout.WINNER = awayCode;
      }
    } else {
      // Group stage: record finished scores.
      if (FINISHED.has(status) && gh != null && ga != null) {
        const key = [homeCode, awayCode].sort().join("|");
        const hit = pairIndex[key];
        if (!hit) { unmatched.push(`${homeName} v ${awayName} (no group fixture)`); continue; }
        base.groupStage[hit.id] = hit.homeCode === homeCode ? [gh, ga] : [ga, gh];
      }
    }
  }

  for (const r of Object.keys(koSets)) base.knockout[r] = Array.from(koSets[r]).sort();

  const merged = mergeResults(base, overrides);
  merged.lastUpdated = new Date().toISOString();
  merged.note = "Auto-generated by fetch-results.js (API-Football + overrides.json). Do not hand-edit; use the admin page or overrides.json.";

  console.log(`  Group results: ${Object.keys(merged.groupStage).length}/72 final.`);
  console.log(`  Knockout reached: ` +
    ["R32", "R16", "QF", "SF", "F"].map((r) => `${r}=${merged.knockout[r].length}`).join(" ") +
    ` WINNER=${merged.knockout.WINNER || "-"}`);
  if (unmatched.length) {
    console.log(`  ! ${unmatched.length} unmatched fixture(s) — add an alias if these are real teams:`);
    for (const u of unmatched.slice(0, 20)) console.log(`      ${u}`);
  }

  if (DRY) {
    console.log("\n--dry-run: not writing results.json");
    return;
  }
  // Pure API layer, so the admin tool can re-merge overrides cleanly (incl. removals).
  fs.writeFileSync(path.join(DATA, "results.base.json"), JSON.stringify(base, null, 2));
  fs.writeFileSync(path.join(DATA, "results.json"), JSON.stringify(merged, null, 2));
  console.log("\nWrote data/results.json (+ results.base.json)");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
