(async function () {
  const { fixtures, predictions, results } = await WC.loadAll();

  // Only allow navigation up to tomorrow — no peeking at future predictions.
  const tomorrowKey = (() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  })();
  const groupDays = WC.matchDays(fixtures);
  const days = WC.allDays(fixtures, results);
  let day = WC.defaultDay(fixtures, results);

  const el = {
    matches: document.getElementById("matches"),
    label: document.getElementById("dateLabel"),
    prev: document.getElementById("prevDay"),
    next: document.getElementById("nextDay"),
    todayJump: document.getElementById("todayJump"),
    legend: document.querySelector(".legend"),
  };

  const GS_LEGEND = el.legend ? el.legend.innerHTML : "";

  function shortDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function firstNames(name) {
    if (!name) return "";
    if (name.includes(" & ")) {
      return name.split(" & ").map(n => n.trim().split(" ")[0]).join(" & ");
    }
    return name.split(" ")[0];
  }

  function ptsClass(p) {
    if (p === 0) return "p0";
    if (p <= 2) return "p2"; // partial (e.g. 1 of 2 R32 picks correct)
    return "p4";             // 4+ pts → gold (both R32 correct, or any R16+ correct pick)
  }

  function predRow(entrant, fx, final) {
    const guess = entrant.groupStage[fx.id];
    const guessStr = guess && guess[0] != null ? `${guess[0]}–${guess[1]}` : "–";
    let ptsHtml;
    if (final && guess && guess[0] != null) {
      const p = Scoring.scoreGroupMatch(guess, results.groupStage[fx.id]);
      ptsHtml = `<div class="pts ${ptsClass(p)}">${p}</div>`;
    } else {
      ptsHtml = `<div class="pts pending">·</div>`;
    }
    const logo = entrant.logo
      ? `<img class="logo" src="${esc(entrant.logo)}" alt="" data-name="${esc(entrant.teamName || entrant.name)}" />`
      : `<div class="logo"></div>`;
    const firstName = firstNames(entrant.name);
    return `
      <div class="pred">
        ${logo}
        <div class="team-name">${esc(entrant.teamName || entrant.name)}</div>
        <div class="player-name">${esc(firstName)}</div>
        <div class="guess">${guessStr}</div>
        ${ptsHtml}
      </div>`;
  }

  function potdCard(dayFixtures) {
    const potd = Scoring.playerOfDay(predictions, dayFixtures, results);
    if (!potd) return "";
    const winners = potd.winners;
    const faces = winners
      .map((w) => (w.logo ? `<img class="potd-logo" src="${esc(w.logo)}" alt="" data-name="${esc(w.teamName || w.name)}" />` : `<div class="potd-logo"></div>`))
      .join("");
    let teamLine, playerLine;
    if (winners.length === 1) {
      teamLine = esc(winners[0].teamName || winners[0].name);
      playerLine = esc(firstNames(winners[0].name));
    } else {
      teamLine = winners.map((w) => esc(firstNames(w.name))).join(" & ");
      playerLine = "tied";
    }
    return `
      <div class="potd ${winners.length > 1 ? "tie" : ""}">
        <div class="potd-faces">${faces}</div>
        <div class="potd-body">
          <div class="potd-label">⭐ Player of the Day</div>
          <div class="potd-team">${teamLine}</div>
          <div class="potd-player">${playerLine}</div>
        </div>
        <div class="potd-pts"><span class="n">+${potd.points}</span><span class="l">pts</span></div>
      </div>`;
  }

  function matchCard(fx) {
    const final = WC.isFinal(fx, results);
    const actual = results.groupStage[fx.id];
    const homeName = teamName(fx.home.code, { short: true });
    const awayName = teamName(fx.away.code, { short: true });
    const showPreds = day <= tomorrowKey;

    const scoreBlock = final
      ? `<div class="big">${actual[0]} – ${actual[1]}</div><span class="status ft">Full time</span>`
      : `<div class="big">${WC.kickoffTime(fx.kickoff) || "TBC"}</div><span class="status upcoming">Kick-off <small class="tz-note">BST</small></span>`;

    let predSection = "";
    if (showPreds) {
      let entrants = predictions.entrants.slice();
      if (final) {
        entrants.sort((a, b) => {
          const pa = Scoring.scoreGroupMatch(a.groupStage[fx.id], actual) ?? -1;
          const pb = Scoring.scoreGroupMatch(b.groupStage[fx.id], actual) ?? -1;
          return pb - pa;
        });
      } else {
        entrants.sort((a, b) =>
          (a.teamName || a.name).localeCompare(b.teamName || b.name));
      }
      let toggle = "See predictions";
      if (final) {
        const top = entrants[0];
        const tp = Scoring.scoreGroupMatch(top.groupStage[fx.id], actual);
        toggle = tp > 0 ? `⭐ ${esc(firstNames(top.name))} +${tp} · see all` : "See predictions & points";
      }
      predSection = `
        <button class="preds-toggle" type="button" aria-expanded="false">
          <span class="lbl">${toggle}</span><span class="chev">▾</span>
        </button>
        <div class="preds-wrap"><div class="preds">
          ${entrants.map((e) => predRow(e, fx, final)).join("")}
        </div></div>`;
    }

    return `
      <div class="match">
        <div class="match-head">
          <div class="team home">
            <span class="flag">${flagFor(fx.home.code)}</span>
            <span class="nm">${esc(homeName)}</span>
          </div>
          <div class="score">${scoreBlock}</div>
          <div class="team away">
            <span class="flag">${flagFor(fx.away.code)}</span>
            <span class="nm">${esc(awayName)}</span>
          </div>
        </div>
        <div class="match-meta">Group ${fx.group} · ${esc(fx.venue || "")}</div>
        ${predSection}
      </div>`;
  }

  // ─── Knockout stage ─────────────────────────────────────────────────────────

  // Points per correct pick for a given round id.
  function koRoundPoints(roundId) {
    const r = fixtures.knockoutRounds.find((x) => x.id === roundId);
    return r ? r.points : 0;
  }

  // Total round points for an entrant: correct picks × round pts.
  function roundTotalFor(entrant, roundId) {
    const advanced = results.knockout[roundId] || [];
    const picks    = entrant.knockout[roundId] || [];
    return picks.filter((c) => advanced.includes(c)).length * koRoundPoints(roundId);
  }

  // Per-entrant row for a knockout match.
  // Two chip states per team: correct (picked) / out (not picked).
  // Points shown only for this round — no next-round bonus.
  function koPredRow(entrant, kofx) {
    const homeCode = resolvedCode(kofx.home);
    const awayCode = resolvedCode(kofx.away);

    const roundPicks    = new Set(entrant.knockout[kofx.round] || []);
    const roundAdvanced = new Set(results.knockout[kofx.round] || []);
    const roundPts      = koRoundPoints(kofx.round);

    function teamChip(code) {
      if (!code) return "";
      const picked = roundPicks.has(code);
      const cls    = picked ? "correct" : "out";
      const ptsLabel = picked && roundAdvanced.has(code) && roundPts > 0
        ? `<span class="chip-pts">+${roundPts}</span>` : "";
      return `<span class="ko-team-chip ${cls}">${flagFor(code)} ${esc(teamName(code, { short: true }))}${ptsLabel}</span>`;
    }

    let earnedPts = null;
    if (roundAdvanced.size > 0 && (homeCode || awayCode)) {
      earnedPts = 0;
      if (homeCode && roundPicks.has(homeCode) && roundAdvanced.has(homeCode)) earnedPts += roundPts;
      if (awayCode && roundPicks.has(awayCode) && roundAdvanced.has(awayCode)) earnedPts += roundPts;
    }

    const ptsHtml = earnedPts != null
      ? `<div class="pts ${ptsClass(earnedPts)}">${earnedPts}</div>`
      : `<div class="pts pending">·</div>`;

    const logo = entrant.logo
      ? `<img class="logo" src="${esc(entrant.logo)}" alt="" data-name="${esc(entrant.teamName || entrant.name)}" />`
      : `<div class="logo"></div>`;

    return `
      <div class="pred ko-match-pred">
        ${logo}
        <div class="player-name">${esc(firstNames(entrant.name))}</div>
        <div class="ko-match-picks">${teamChip(homeCode)}${teamChip(awayCode)}</div>
        ${ptsHtml}
      </div>`;
  }

  // Expandable round-leader card with full standings table.
  function roundLeaderCard(roundId) {
    const advanced = results.knockout[roundId] || [];
    if (!advanced.length) return "";

    const ranked = predictions.entrants
      .slice()
      .sort((a, b) => roundTotalFor(b, roundId) - roundTotalFor(a, roundId)
        || (a.teamName || a.name).localeCompare(b.teamName || b.name));

    const topPts = roundTotalFor(ranked[0], roundId);
    const leaders = ranked.filter((e) => roundTotalFor(e, roundId) === topPts);
    const isTie = leaders.length > 1;

    const MAX_FACES = 3;
    const facesToShow = leaders.slice(0, MAX_FACES);
    const extraCount  = leaders.length - MAX_FACES;
    const leaderFaces = facesToShow.map((l) =>
      l.logo ? `<img class="potd-logo" src="${esc(l.logo)}" alt="" data-name="${esc(l.teamName || l.name)}" />`
             : `<div class="potd-logo"></div>`
    ).join("") + (extraCount > 0 ? `<span class="potd-extra">+${extraCount}</span>` : "");

    const nameLabel = isTie ? `${leaders.length} tied` : esc(firstNames(leaders[0].name));
    const teamLabel = isTie ? "Multiple leaders" : esc(leaders[0].teamName || leaders[0].name);

    const tableRows = ranked.map((e, i) => {
      const pts = roundTotalFor(e, roundId);
      const isLeader = pts === topPts;
      const logoEl = e.logo
        ? `<img class="potd-logo sm" src="${esc(e.logo)}" alt="" />`
        : `<div class="potd-logo sm"></div>`;
      return `<div class="round-score-row${isLeader ? " leader" : ""}">
        <span class="rs-rank">${i + 1}</span>
        ${logoEl}
        <span class="rs-name">${esc(firstNames(e.name))}</span>
        <span class="rs-pts">${pts} pts</span>
      </div>`;
    }).join("");

    return `
      <div class="potd-expandable" role="button" tabindex="0" aria-expanded="false">
        <div class="potd${isTie ? " tie" : ""}">
          <div class="potd-faces">${leaderFaces}</div>
          <div class="potd-body">
            <div class="potd-label">⭐ Round leader</div>
            <div class="potd-team">${teamLabel}</div>
            <div class="potd-player">${nameLabel}</div>
          </div>
          <div class="potd-pts"><span class="n">${topPts}</span><span class="l">pts</span></div>
        </div>
        <p class="potd-hint">Click to see round standings</p>
        <div class="round-scores">${tableRows}</div>
      </div>`;
  }

  // Resolve a knockout fixture side to its team code (walks bracket via knockoutStage scores).
  function resolvedCode(side) {
    return WC.resolveTeamCode(side, fixtures, results);
  }

  // Display helpers for a side that may still be TBD.
  function sideFlag(side) {
    const code = resolvedCode(side);
    if (code) return flagFor(code);
    // Show both possible teams as split flags before the source match is settled
    if (side.sourceMatch) {
      const src = (fixtures.knockoutFixtures || []).find((f) => f.id === side.sourceMatch);
      if (src) {
        const h = resolvedCode(src.home);
        const a = resolvedCode(src.away);
        if (h && a) return `<span class="tbd-flags">${flagFor(h)}/${flagFor(a)}</span>`;
        if (h) return flagFor(h);
        if (a) return flagFor(a);
      }
    }
    return "🏳️";
  }

  function sideName(side) {
    const code = resolvedCode(side);
    if (code) return teamName(code, { short: true });
    if (side.sourceMatch) {
      const src = (fixtures.knockoutFixtures || []).find((f) => f.id === side.sourceMatch);
      if (src) {
        const h = resolvedCode(src.home);
        const a = resolvedCode(src.away);
        const hn = h ? teamName(h, { short: true }) : (src.home.name || "?");
        const an = a ? teamName(a, { short: true }) : (src.away.name || "?");
        return `${hn} / ${an}`;
      }
    }
    return side.name || "TBD";
  }

  // Single knockout match card (analogous to group-stage matchCard).
  function knockoutMatchCard(kofx) {
    const final = WC.isKOFinal(kofx, results);
    const actual = (results.knockoutStage || {})[kofx.id];
    const homeCode = resolvedCode(kofx.home);
    const awayCode = resolvedCode(kofx.away);
    const round = fixtures.knockoutRounds.find((r) => r.id === kofx.round);

    const dateLabel = kofx.kickoff ? `<div class="fixture-date">${shortDate(kofx.kickoff)}</div>` : "";
    const penData = (results.knockoutPens || {})[kofx.id];
    let penLine = "";
    if (final && penData) {
      const homeWins = penData[0] > penData[1];
      const winScore = homeWins ? penData[0] : penData[1];
      const loseScore = homeWins ? penData[1] : penData[0];
      const winName = esc(sideName(homeWins ? kofx.home : kofx.away));
      penLine = `<div class="pen-result">${winName} win ${winScore}–${loseScore} on pens</div>`;
    }
    const scoreBlock = final
      ? `${dateLabel}<div class="big">${actual[0]} – ${actual[1]}</div><span class="status ft">Full time</span>${penLine}`
      : `${dateLabel}<div class="big">${WC.kickoffTime(kofx.kickoff) || "TBC"}</div><span class="status upcoming">Kick-off <small class="tz-note">BST</small></span>`;

    const matchCodes = [homeCode, awayCode].filter(Boolean);
    const roundAdvanced = new Set(results.knockout[kofx.round] || []);
    const roundPts = koRoundPoints(kofx.round);
    const settled = roundAdvanced.size > 0;

    const matchPtsFor = (e) => {
      const picks = new Set(e.knockout[kofx.round] || []);
      return matchCodes.filter((c) => picks.has(c) && roundAdvanced.has(c)).length * roundPts;
    };

    let entrants = predictions.entrants.slice();
    if (settled && matchCodes.length === 2) {
      entrants.sort((a, b) => matchPtsFor(b) - matchPtsFor(a) || (a.teamName || a.name).localeCompare(b.teamName || b.name));
    } else {
      entrants.sort((a, b) => (a.teamName || a.name).localeCompare(b.teamName || b.name));
    }

    const top = settled && matchCodes.length === 2 ? entrants[0] : null;
    const topPts = top ? matchPtsFor(top) : 0;
    const toggle = "See predictions";

    return `
      <div class="match">
        <div class="match-head">
          <div class="team home">
            <span class="flag">${sideFlag(kofx.home)}</span>
            <span class="nm">${esc(sideName(kofx.home))}</span>
          </div>
          <div class="score">${scoreBlock}</div>
          <div class="team away">
            <span class="flag">${sideFlag(kofx.away)}</span>
            <span class="nm">${esc(sideName(kofx.away))}</span>
          </div>
        </div>
        <div class="match-meta">${round ? round.label : kofx.round} · ${esc(kofx.venue || "")}</div>
        <button class="preds-toggle" type="button" aria-expanded="false">
          <span class="lbl">${toggle}</span><span class="chev">▾</span>
        </button>
        <div class="preds-wrap"><div class="preds">
          ${entrants.map((e) => koPredRow(e, kofx)).join("")}
        </div></div>
      </div>`;
  }

  // Knockout round page: round leader card + all match cards.
  function knockoutCard(roundKey) {
    const roundId = roundKey.slice(3);
    const roundFixtures = WC.knockoutFixturesForRound(fixtures, roundId);
    if (!roundFixtures.length) {
      return `<div class="empty"><div class="big">🗓️</div><p>Fixtures not yet scheduled.</p></div>`;
    }
    return roundLeaderCard(roundId) + roundFixtures.map(knockoutMatchCard).join("");
  }

  function render() {
    const isKO = day.startsWith("KO:");
    const idx = days.indexOf(day);
    el.prev.disabled = idx <= 0;
    el.next.disabled = idx >= days.length - 1;

    if (isKO) {
      el.label.innerHTML = `${WC.prettyLabel(day, fixtures)}<small>Knockout stage</small>`;
      if (el.legend) {
        const roundId = day.slice(3);
        const pts = koRoundPoints(roundId);
        el.legend.innerHTML =
          `<span><i style="background:#e2e8f0;border:1px solid #cbd5e1"></i> Not predicted</span>` +
          `<span><i style="background:#dcfce7;border:1px solid #bbf7d0"></i> Predicted (+${pts}pts)</span>`;
      }
    } else {
      const gIdx = groupDays.indexOf(day);
      el.label.innerHTML = `${WC.prettyLabel(day, fixtures)}<small>Matchday ${gIdx + 1} of ${groupDays.length}</small>`;
      if (el.legend) el.legend.innerHTML = GS_LEGEND;
    }
    el.todayJump.style.display = day === WC.todayKey() ? "none" : "block";

    if (isKO) {
      el.matches.innerHTML = knockoutCard(day);
      return;
    }

    const todays = WC.fixturesOnDay(fixtures, day);
    if (!todays.length) {
      el.matches.innerHTML = `<div class="empty"><div class="big">🌴</div><p>No matches on this day.</p></div>`;
      return;
    }
    el.matches.innerHTML = potdCard(todays) + todays.map(matchCard).join("");

    // Auto-show a match day GIF the first time a visitor loads on an England match day.
    const isToday = day === WC.todayKey();
    const hasEngland = todays.some((f) => f.home.code === "ENG" || f.away.code === "ENG");
    if (isToday && hasEngland && window.EasterEgg) {
      setTimeout(() => window.EasterEgg.showEnglandDay(day), 800);
    }
  }

  // Tap the POTD card to expand/collapse the round scores table.
  el.matches.addEventListener("click", (e) => {
    const potd = e.target.closest(".potd-expandable");
    if (potd) potd.classList.toggle("open");
  });

  // Tap a match (header or toggle bar) to expand/collapse its predictions.
  el.matches.addEventListener("click", (e) => {
    const hit = e.target.closest(".preds-toggle, .match-head");
    if (!hit) return;
    const card = hit.closest(".match");
    const open = card.classList.toggle("open");
    const btn = card.querySelector(".preds-toggle");
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  el.prev.onclick = () => { const i = days.indexOf(day); if (i > 0) { day = days[i - 1]; render(); } };
  el.next.onclick = () => { const i = days.indexOf(day); if (i < days.length - 1) { day = days[i + 1]; render(); } };
  el.todayJump.onclick = () => {
    const t = WC.todayKey();
    day = days.includes(t) ? t : WC.defaultDay(fixtures, results);
    render();
  };

  render();
})();
