// Shared merge logic: overrides always win over the API/base layer.
// Used by both fetch-results.js and admin-server.js so precedence lives in one place.

// Walk the static bracket to resolve a side's team code from knockoutStage scores.
function resolveCode(side, fixtures, ks, kp, depth) {
  if (side.code) return side.code;
  if (!side.sourceMatch || (depth || 0) > 5) return null;
  const src = (fixtures.knockoutFixtures || []).find(f => f.id === side.sourceMatch);
  if (!src) return null;
  const score = ks[src.id];
  if (!score || score[0] == null) return null;
  const h = resolveCode(src.home, fixtures, ks, kp, (depth || 0) + 1);
  const a = resolveCode(src.away, fixtures, ks, kp, (depth || 0) + 1);
  if (score[0] === score[1]) {
    const p = kp[src.id];
    if (!p) return null;
    return p[0] > p[1] ? h : a;
  }
  return score[0] > score[1] ? h : a;
}

// Re-derive knockout advancement arrays from the merged knockoutStage scores.
// This means overriding a score automatically updates R16/QF/SF/F — no manual array overrides needed.
function deriveAdvancement(fixtures, ks, kp) {
  const sets = { R32: new Set(), R16: new Set(), QF: new Set(), SF: new Set(), F: new Set() };
  for (const kofx of (fixtures.knockoutFixtures || []).filter(f => f.round === "R32")) {
    if (kofx.home.code) sets.R32.add(kofx.home.code);
    if (kofx.away.code) sets.R32.add(kofx.away.code);
  }
  const roundNext = { R32: "R16", R16: "QF", QF: "SF", SF: "F" };
  for (const kofx of (fixtures.knockoutFixtures || [])) {
    const score = ks[kofx.id];
    if (!score) continue;
    const h = resolveCode(kofx.home, fixtures, ks, kp, 0);
    const a = resolveCode(kofx.away, fixtures, ks, kp, 0);
    let winner;
    if (score[0] > score[1]) winner = h;
    else if (score[0] < score[1]) winner = a;
    else { const p = kp[kofx.id]; winner = p ? (p[0] > p[1] ? h : a) : null; }
    const next = roundNext[kofx.round];
    if (next && winner) sets[next].add(winner);
  }
  const result = {};
  for (const r of ["R32", "R16", "QF", "SF", "F"]) result[r] = Array.from(sets[r]).sort();
  return result;
}

function mergeResults(base, overrides, fixtures) {
  const out = {
    groupStage:    { ...(base.groupStage    || {}) },
    knockoutStage: { ...(base.knockoutStage || {}) },
    knockoutPens:  { ...(base.knockoutPens  || {}) },
    knockout: {
      R32: [], R16: [], QF: [], SF: [], F: [], WINNER: null,
      ...(base.knockout || {}),
    },
  };

  // Group stage: each override entry replaces the base score for that fixture.
  const ovGroup = (overrides && overrides.groupStage) || {};
  for (const id of Object.keys(ovGroup)) {
    const v = ovGroup[id];
    if (v && v[0] != null && v[1] != null) out.groupStage[id] = [Number(v[0]), Number(v[1])];
  }

  // Knockout stage: individual match score overrides.
  const ovKS = (overrides && overrides.knockoutStage) || {};
  for (const id of Object.keys(ovKS)) {
    const v = ovKS[id];
    if (v && v[0] != null && v[1] != null) out.knockoutStage[id] = [Number(v[0]), Number(v[1])];
  }

  // Knockout penalty data.
  const ovKP = (overrides && overrides.knockoutPens) || {};
  for (const id of Object.keys(ovKP)) {
    const v = ovKP[id];
    if (v && v[0] != null && v[1] != null) out.knockoutPens[id] = [Number(v[0]), Number(v[1])];
  }

  // Re-derive advancement arrays from the merged scores (when fixtures are available).
  // This means adding a knockoutStage override automatically propagates to QF/SF/F.
  if (fixtures) {
    const derived = deriveAdvancement(fixtures, out.knockoutStage, out.knockoutPens);
    for (const r of ["R32", "R16", "QF", "SF", "F"]) out.knockout[r] = derived[r];
  }

  // WINNER: explicit override wins; otherwise keep base value.
  const ovKo = (overrides && overrides.knockout) || {};
  if (ovKo.WINNER) out.knockout.WINNER = ovKo.WINNER;

  return out;
}

module.exports = { mergeResults, deriveAdvancement };
