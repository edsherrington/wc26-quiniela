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
  };

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
    if (p <= 1) return "p1";
    if (p <= 4) return "p2";
    return "p4"; // anything above 4 (KO pts: 6, 9, 14, 25) gets the gold class
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

  // Next round id for a given knockout round (used to determine who "won" a match).
  const KO_NEXT = { R32: "R16", R16: "QF", QF: "SF", SF: "F", F: "WINNER" };

  // Points per correct pick for a given round id.
  function koRoundPoints(roundId) {
    const r = fixtures.knockoutRounds.find((x) => x.id === roundId);
    return r ? r.points : 0;
  }

  // Round-level POTD: total pts across all settled matches in the round.
  function koRoundPotdCard(roundId, roundFixtures) {
    const nextRound = KO_NEXT[roundId];
    if (!nextRound) return "";
    const advanced = nextRound === "WINNER"
      ? new Set(results.knockout.WINNER ? [results.knockout.WINNER] : [])
      : new Set(results.knockout[nextRound] || []);
    if (!advanced.size) return "";
    const pts = koRoundPoints(nextRound);

    const rows = predictions.entrants.map((e) => {
      const picks = nextRound === "WINNER"
        ? (e.knockout.WINNER ? [e.knockout.WINNER] : [])
        : (e.knockout[nextRound] || []);
      let total = 0;
      for (const kofx of roundFixtures) {
        if (!WC.isKOFinal(kofx, results)) continue;
        const hc = WC.resolveTeamCode(kofx.home, fixtures, results);
        const ac = WC.resolveTeamCode(kofx.away, fixtures, results);
        const matchCodes = new Set([hc, ac].filter(Boolean));
        total += picks.filter((p) => matchCodes.has(p) && advanced.has(p)).length * pts;
      }
      return { e, total };
    });

    const max = Math.max(...rows.map((r) => r.total));
    if (max <= 0) return "";
    const winners = rows.filter((r) => r.total === max).map((r) => r.e);

    const MAX_LOGOS = 4;
    const shown = winners.slice(0, MAX_LOGOS);
    const extra = winners.length - shown.length;
    const faces = shown.map((w) =>
      w.logo
        ? `<img class="potd-logo" src="${esc(w.logo)}" alt="" data-name="${esc(w.teamName || w.name)}" />`
        : `<div class="potd-logo"></div>`
    ).join("") + (extra > 0 ? `<div class="potd-logo potd-extra">+${extra}</div>` : "");

    let teamLine, playerLine;
    if (winners.length === 1) {
      teamLine = esc(winners[0].teamName || winners[0].name);
      playerLine = esc(firstNames(winners[0].name));
    } else {
      teamLine = shown.map((w) => esc(firstNames(w.name))).join(", ") + (extra > 0 ? ` +${extra}` : "");
      playerLine = "tied";
    }

    return `
      <div class="potd ${winners.length > 1 ? "tie" : ""}">
        <div class="potd-faces">${faces}</div>
        <div class="potd-body">
          <div class="potd-label">⭐ Player of the Round</div>
          <div class="potd-team">${teamLine}</div>
          <div class="potd-player">${playerLine}</div>
        </div>
        <div class="potd-pts"><span class="n">+${max}</span><span class="l">pts</span></div>
      </div>`;
  }

  // Per-entrant row for a knockout match: shows which of the two teams they picked
  // to advance (from their next-round picks), and pts earned.
  function koPredRow(entrant, kofx) {
    const nextRound = KO_NEXT[kofx.round];
    if (!nextRound) return "";

    const homeCode = resolvedCode(kofx.home);
    const awayCode = resolvedCode(kofx.away);

    const advanced = nextRound === "WINNER"
      ? new Set(results.knockout.WINNER ? [results.knockout.WINNER] : [])
      : new Set(results.knockout[nextRound] || []);
    const settled = advanced.size > 0 || WC.isKOFinal(kofx, results);

    const nextPicks = nextRound === "WINNER"
      ? new Set(entrant.knockout.WINNER ? [entrant.knockout.WINNER] : [])
      : new Set(entrant.knockout[nextRound] || []);

    const pickedHome = homeCode && nextPicks.has(homeCode);
    const pickedAway = awayCode && nextPicks.has(awayCode);
    const pts = koRoundPoints(nextRound);

    let earnedPts = null;
    if (settled && (homeCode || awayCode)) {
      earnedPts = 0;
      if (pickedHome && advanced.has(homeCode)) earnedPts += pts;
      if (pickedAway && advanced.has(awayCode)) earnedPts += pts;
    }

    // Guess cell: chip(s) for team(s) they picked to win this match
    let guessHtml;
    if (!pickedHome && !pickedAway) {
      guessHtml = `<div class="guess">–</div>`;
    } else {
      const chips = [];
      if (pickedHome && homeCode) {
        const hit = settled && advanced.has(homeCode);
        const miss = settled && !advanced.has(homeCode);
        chips.push(`<span class="ko-inline-chip ${hit ? "hit" : miss ? "miss" : ""}">${flagFor(homeCode)} ${esc(teamName(homeCode, { short: true }))}</span>`);
      }
      if (pickedAway && awayCode) {
        const hit = settled && advanced.has(awayCode);
        const miss = settled && !advanced.has(awayCode);
        chips.push(`<span class="ko-inline-chip ${hit ? "hit" : miss ? "miss" : ""}">${flagFor(awayCode)} ${esc(teamName(awayCode, { short: true }))}</span>`);
      }
      guessHtml = `<div class="guess ko-guess">${chips.join("")}</div>`;
    }

    const ptsHtml = earnedPts != null
      ? `<div class="pts ${ptsClass(earnedPts)}">${earnedPts}</div>`
      : `<div class="pts pending">·</div>`;

    const logo = entrant.logo
      ? `<img class="logo" src="${esc(entrant.logo)}" alt="" data-name="${esc(entrant.teamName || entrant.name)}" />`
      : `<div class="logo"></div>`;

    return `
      <div class="pred">
        ${logo}
        <div class="team-name">${esc(entrant.teamName || entrant.name)}</div>
        <div class="player-name">${esc(firstNames(entrant.name))}</div>
        ${guessHtml}
        ${ptsHtml}
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
    const nextRound = KO_NEXT[kofx.round];

    const scoreBlock = final
      ? `<div class="big">${actual[0]} – ${actual[1]}</div><span class="status ft">Full time</span>`
      : `<div class="big">${WC.kickoffTime(kofx.kickoff) || "TBC"}</div><span class="status upcoming">Kick-off <small class="tz-note">BST</small></span>`;

    // Use resolved codes for pred matching; fall back gracefully if still TBD.
    const matchCodes = [homeCode, awayCode].filter(Boolean);

    const advanced = nextRound && nextRound !== "WINNER"
      ? new Set(results.knockout[nextRound] || [])
      : new Set(results.knockout.WINNER ? [results.knockout.WINNER] : []);
    const settled = advanced.size > 0 || final;
    const nextPts = nextRound ? koRoundPoints(nextRound) : 0;

    let entrants = predictions.entrants.slice();
    if (settled && matchCodes.length === 2) {
      entrants.sort((a, b) => {
        const ptsFor = (e) => {
          const picks = nextRound === "WINNER"
            ? (e.knockout.WINNER ? [e.knockout.WINNER] : [])
            : (e.knockout[nextRound] || []);
          return picks.filter((p) => matchCodes.includes(p) && advanced.has(p)).length * nextPts;
        };
        return ptsFor(b) - ptsFor(a) || (a.teamName || a.name).localeCompare(b.teamName || b.name);
      });
    } else {
      entrants.sort((a, b) => (a.teamName || a.name).localeCompare(b.teamName || b.name));
    }

    const top = settled && matchCodes.length === 2 ? entrants[0] : null;
    const topPts = top && nextRound ? (() => {
      const picks = nextRound === "WINNER"
        ? (top.knockout.WINNER ? [top.knockout.WINNER] : [])
        : (top.knockout[nextRound] || []);
      return picks.filter((p) => matchCodes.includes(p) && advanced.has(p)).length * nextPts;
    })() : 0;

    const toggle = settled && topPts > 0
      ? `⭐ ${esc(firstNames(top.name))} +${topPts} · see all`
      : "See picks";

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

  // Knockout round page: round-level POTD + all match cards.
  function knockoutCard(roundKey) {
    const roundId = roundKey.slice(3);
    const roundFixtures = WC.knockoutFixturesForRound(fixtures, roundId);
    if (!roundFixtures.length) {
      return `<div class="empty"><div class="big">🗓️</div><p>Fixtures not yet scheduled.</p></div>`;
    }
    const potd = koRoundPotdCard(roundId, roundFixtures);
    return potd + roundFixtures.map(knockoutMatchCard).join("");
  }

  function render() {
    const isKO = day.startsWith("KO:");
    const idx = days.indexOf(day);
    el.prev.disabled = idx <= 0;
    el.next.disabled = idx >= days.length - 1;

    if (isKO) {
      el.label.innerHTML = `${WC.prettyLabel(day, fixtures)}<small>Knockout stage</small>`;
    } else {
      const gIdx = groupDays.indexOf(day);
      el.label.innerHTML = `${WC.prettyLabel(day, fixtures)}<small>Matchday ${gIdx + 1} of ${groupDays.length}</small>`;
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
