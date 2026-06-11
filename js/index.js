(async function () {
  const { fixtures, predictions, results } = await WC.loadAll();

  // Only allow navigation up to tomorrow — no peeking at future predictions.
  const tomorrowKey = (() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  })();
  const days = WC.matchDays(fixtures);
  let day = WC.defaultDay(fixtures);

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
    return p === 4 ? "p4" : p === 2 ? "p2" : p === 1 ? "p1" : "p0";
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
      : `<div class="big">${WC.kickoffTime(fx.kickoff) || "TBC"}</div><span class="status upcoming">Kick-off</span>`;

    let predSection = "";
    if (showPreds) {
      let entrants = predictions.entrants.slice();
      if (final) {
        entrants.sort((a, b) => {
          const pa = Scoring.scoreGroupMatch(a.groupStage[fx.id], actual) ?? -1;
          const pb = Scoring.scoreGroupMatch(b.groupStage[fx.id], actual) ?? -1;
          return pb - pa;
        });
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

  function render() {
    const idx = days.indexOf(day);
    el.prev.disabled = idx <= 0;
    el.next.disabled = idx >= days.length - 1;
    el.label.innerHTML = `${WC.prettyDate(day)}<small>Matchday ${idx + 1} of ${days.length}</small>`;
    el.todayJump.style.display = day === WC.todayKey() ? "none" : "block";

    const todays = WC.fixturesOnDay(fixtures, day);
    if (!todays.length) {
      el.matches.innerHTML = `<div class="empty"><div class="big">🌴</div><p>No matches on this day.</p></div>`;
      return;
    }
    el.matches.innerHTML = potdCard(todays) + todays.map(matchCard).join("");
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
    day = days.includes(t) ? t : WC.defaultDay(fixtures);
    render();
  };

  render();
})();
