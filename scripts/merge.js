// Shared merge logic: overrides always win over the API/base layer.
// Used by both fetch-results.js and admin-server.js so precedence lives in one place.

function mergeResults(base, overrides) {
  const out = {
    groupStage:    { ...(base.groupStage    || {}) },
    knockoutStage: { ...(base.knockoutStage || {}) },
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

  // Knockout stage: individual match score overrides (same shape as groupStage).
  const ovKS = (overrides && overrides.knockoutStage) || {};
  for (const id of Object.keys(ovKS)) {
    const v = ovKS[id];
    if (v && v[0] != null && v[1] != null) out.knockoutStage[id] = [Number(v[0]), Number(v[1])];
  }

  // Knockout round advancement: a non-empty override array replaces that round.
  const ovKo = (overrides && overrides.knockout) || {};
  for (const r of ["R32", "R16", "QF", "SF", "F"]) {
    if (Array.isArray(ovKo[r]) && ovKo[r].length) out.knockout[r] = ovKo[r].slice();
  }
  if (ovKo.WINNER) out.knockout.WINNER = ovKo.WINNER;

  return out;
}

module.exports = { mergeResults };
