// Pure scoring engine. No DOM. Recomputes everything from predictions + results on each load.
(function () {
  // Group-stage match score for one prediction vs the actual result.
  // pred / actual are [homeGoals, awayGoals] or null/incomplete.
  // Returns points (0/1/2/4) or null if no prediction or match not yet final.
  function scoreGroupMatch(pred, actual) {
    if (!pred || pred[0] == null || pred[1] == null) return null;
    if (!actual || actual[0] == null || actual[1] == null) return null;
    const pa = pred[0], pb = pred[1], aa = actual[0], ab = actual[1];
    if (pa === aa && pb === ab) return 4; // exact scoreline
    const psign = Math.sign(pa - pb), asign = Math.sign(aa - ab);
    if (psign === asign) {
      return (pa - pb) === (aa - ab) ? 2 : 1; // correct result (+GD), or correct result only
    }
    return 0; // wrong result
  }

  // Full breakdown for one entrant given fixtures + results.
  function entrantScore(entrant, fixtures, results) {
    const perMatch = {};
    let group = 0;
    for (const fx of fixtures.groupStage) {
      const pts = scoreGroupMatch(entrant.groupStage[fx.id], results.groupStage[fx.id]);
      if (pts != null) {
        group += pts;
        perMatch[fx.id] = pts;
      }
    }

    const perRound = {};
    let knockout = 0;
    for (const r of fixtures.knockoutRounds) {
      const actual = r.id === "WINNER"
        ? (results.knockout.WINNER ? [results.knockout.WINNER] : [])
        : (results.knockout[r.id] || []);
      if (!actual.length) continue; // round not settled yet
      const picks = r.id === "WINNER"
        ? (entrant.knockout.WINNER ? [entrant.knockout.WINNER] : [])
        : (entrant.knockout[r.id] || []);
      const set = new Set(actual);
      const correct = picks.filter((p) => set.has(p));
      const pts = correct.length * r.points;
      knockout += pts;
      perRound[r.id] = { correct: correct.length, total: picks.length, points: pts, settled: true };
    }

    return { group, knockout, total: group + knockout, perMatch, perRound };
  }

  // Leaderboard: every entrant scored, sorted high to low (ties share a rank).
  function leaderboard(predictions, fixtures, results) {
    const rows = predictions.entrants.map((e) => {
      const s = entrantScore(e, fixtures, results);
      return { entrant: e, ...s };
    });
    rows.sort((a, b) => b.total - a.total || b.group - a.group
      || (a.entrant.teamName || a.entrant.name).localeCompare(b.entrant.teamName || b.entrant.name));
    let rank = 0, prev = null;
    rows.forEach((row, i) => {
      if (prev === null || row.total !== prev) { rank = i + 1; prev = row.total; }
      row.rank = rank;
    });
    return rows;
  }

  // Points each entrant earned across one day's already-final group matches.
  // Returns null if no match that day is final yet.
  function dayBreakdown(predictions, dayFixtures, results) {
    const finals = dayFixtures.filter((fx) => {
      const r = results.groupStage[fx.id];
      return r && r[0] != null && r[1] != null;
    });
    if (!finals.length) return null;
    const rows = predictions.entrants.map((e) => {
      let points = 0;
      for (const fx of finals) {
        const p = scoreGroupMatch(e.groupStage[fx.id], results.groupStage[fx.id]);
        if (p != null) points += p;
      }
      return { entrant: e, points };
    });
    return { finalCount: finals.length, rows };
  }

  // Player(s) of the day: the entrant(s) with the most points from that day's final
  // matches. Null if no finals, or if the best score is 0 (nobody actually scored).
  function playerOfDay(predictions, dayFixtures, results) {
    const bd = dayBreakdown(predictions, dayFixtures, results);
    if (!bd) return null;
    const max = Math.max(...bd.rows.map((r) => r.points));
    if (max <= 0) return null;
    return { points: max, winners: bd.rows.filter((r) => r.points === max).map((r) => r.entrant) };
  }

  window.Scoring = { scoreGroupMatch, entrantScore, leaderboard, dayBreakdown, playerOfDay };
})();
