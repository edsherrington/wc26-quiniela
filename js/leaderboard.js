(async function () {
  const { fixtures, predictions, results } = await WC.loadAll();
  const board = document.getElementById("board");

  function esc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  // Count "Player of the Day" wins per entrant across every matchday so far.
  const dayWins = {};
  for (const day of WC.matchDays(fixtures)) {
    const potd = Scoring.playerOfDay(predictions, WC.fixturesOnDay(fixtures, day), results);
    if (!potd) continue;
    for (const w of potd.winners) dayWins[w.id] = (dayWins[w.id] || 0) + 1;
  }

  // --- Freshness indicator ---
  function freshnessHtml() {
    const today = WC.todayKey();
    const todayFx = WC.fixturesOnDay(fixtures, today);
    const now = Date.now();
    // Matches that have kicked off (give 90+stoppage: 115 min buffer)
    const kicked = todayFx.filter((fx) => new Date(fx.kickoff).getTime() + 115 * 60 * 1000 < now);
    const allIn = kicked.length > 0 && kicked.every((fx) => WC.isFinal(fx, results));

    if (allIn) {
      return `<div class="freshness up-to-date">✓ Up-to-date</div>`;
    }
    if (!results.lastUpdated) return "";
    const d = new Date(results.lastUpdated);
    const sameDay = d.toDateString() === new Date().toDateString();
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const label = sameDay ? time : `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
    return `<div class="freshness stale">Last updated: ${label}</div>`;
  }

  const rows = Scoring.leaderboard(predictions, fixtures, results);
  const anyPoints = rows.some((r) => r.total > 0);


  let html = freshnessHtml();
  if (!anyPoints) {
    html += `<div class="note-card">No results are in yet. Scores will appear here the moment match results start landing. The order below is just everyone's starting line.</div>`;
  }

  html += rows
    .map((r) => {
      const top = r.rank <= 3 ? `top${r.rank}` : "";
      const logo = r.entrant.logo
        ? `<img class="logo" src="${esc(r.entrant.logo)}" alt="" data-name="${esc(r.entrant.teamName || r.entrant.name)}" />`
        : `<div class="logo"></div>`;
      const medal = r.rank;
      return `
        <div class="lb-row ${top}">
          <div class="rank">${medal}</div>
          ${logo}
          <div class="who">
            <div class="name">${esc(r.entrant.teamName || r.entrant.name)}</div>
            <div class="team">${esc(r.entrant.name)}</div>
            ${dayWins[r.entrant.id] ? `<div class="split">⭐ ${dayWins[r.entrant.id]} day${dayWins[r.entrant.id] > 1 ? "s" : ""} won</div>` : ""}
          </div>
          <div class="total"><div class="n">${r.total}</div><div class="l">pts</div></div>
        </div>`;
    })
    .join("");

  board.innerHTML = html;

  showWinnerModal(results.knockout?.WINNER, rows);
})();
