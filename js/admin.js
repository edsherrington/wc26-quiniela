(async function () {
  const bust = "?v=" + Date.now();
  const [fixtures, overrides, results] = await Promise.all([
    fetch("data/fixtures.json" + bust).then((r) => r.json()),
    fetch("data/overrides.json" + bust).then((r) => r.json()).catch(() => ({})),
    fetch("data/results.json" + bust).then((r) => r.json()).catch(() => ({ groupStage: {}, knockout: {} })),
  ]);

  // Working state, seeded from existing overrides.
  const groupState = { ...(overrides.groupStage || {}) };       // GS-xx -> [h,a]
  const koState = {
    R32: (overrides.knockout?.R32 || []).slice(),
    R16: (overrides.knockout?.R16 || []).slice(),
    QF: (overrides.knockout?.QF || []).slice(),
    SF: (overrides.knockout?.SF || []).slice(),
    F: (overrides.knockout?.F || []).slice(),
    WINNER: overrides.knockout?.WINNER || "",
  };

  const days = WC.matchDays(fixtures);
  let day = WC.defaultDay(fixtures);

  const el = (id) => document.getElementById(id);
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  // ---------- Group editor ----------
  function renderGroup() {
    const idx = days.indexOf(day);
    el("prevDay").disabled = idx <= 0;
    el("nextDay").disabled = idx >= days.length - 1;
    el("dateLabel").innerHTML = `${WC.prettyDate(day)}<small>Matchday ${idx + 1} of ${days.length}</small>`;

    const todays = WC.fixturesOnDay(fixtures, day);
    el("groupEditor").innerHTML = todays.map((fx) => {
      const ov = groupState[fx.id];
      const eff = results.groupStage?.[fx.id];
      const hv = ov ? ov[0] : "";
      const av = ov ? ov[1] : "";
      const hp = eff ? eff[0] : "";
      const ap = eff ? eff[1] : "";
      return `
        <div class="adm-match ${ov ? "has-override" : ""}" data-id="${fx.id}">
          <div class="side home">
            <span class="flag">${flagFor(fx.home.code)}</span>
            <span class="nm">${fx.home.code}</span>
          </div>
          <div class="inputs">
            <input class="score" inputmode="numeric" data-side="h" value="${hv}" placeholder="${hp}" maxlength="2" />
            <span class="dash">–</span>
            <input class="score" inputmode="numeric" data-side="a" value="${av}" placeholder="${ap}" maxlength="2" />
          </div>
          <div class="side away">
            <span class="flag">${flagFor(fx.away.code)}</span>
            <span class="nm">${fx.away.code}</span>
          </div>
          <div class="meta">Group ${fx.group} · ${esc(fx.venue || "")} · ${fx.id}</div>
        </div>`;
    }).join("");

    el("groupEditor").querySelectorAll(".adm-match").forEach((card) => {
      const id = card.dataset.id;
      const inputs = card.querySelectorAll("input.score");
      const sync = () => {
        const h = inputs[0].value.trim();
        const a = inputs[1].value.trim();
        if (h !== "" && a !== "") { groupState[id] = [Number(h), Number(a)]; card.classList.add("has-override"); }
        else { delete groupState[id]; card.classList.remove("has-override"); }
      };
      inputs.forEach((i) => i.addEventListener("input", sync));
    });
  }

  el("prevDay").onclick = () => { const i = days.indexOf(day); if (i > 0) { day = days[i - 1]; renderGroup(); } };
  el("nextDay").onclick = () => { const i = days.indexOf(day); if (i < days.length - 1) { day = days[i + 1]; renderGroup(); } };

  // ---------- Knockout editor ----------
  const KO_META = fixtures.knockoutRounds.filter((r) => r.id !== "WINNER");
  function chip(code) {
    const known = !!window.TEAMS[code];
    return `<span class="ko-chip ${known ? "" : "bad"}">${known ? flagFor(code) + " " + teamName(code, { short: true }) : code + " ?"}</span>`;
  }
  function parseCodes(str) {
    return str.split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
  }
  function renderKo() {
    el("koEditor").innerHTML = KO_META.map((r) => `
      <div class="ko-round" data-round="${r.id}">
        <h3>${esc(r.label)} <span class="pts">(${r.points} pts/team · expects ${roundSize(r.id)})</span></h3>
        <input type="text" data-round="${r.id}" value="${esc((koState[r.id] || []).join(" "))}" placeholder="e.g. ENG FRA BRA ARG ..." />
        <div class="ko-preview" data-preview="${r.id}"></div>
      </div>`).join("") + `
      <div class="ko-round">
        <h3>Champion <span class="pts">(25 pts)</span></h3>
        <input type="text" id="winnerInput" value="${esc(koState.WINNER || "")}" placeholder="e.g. ARG" maxlength="3" />
        <div class="ko-preview" data-preview="WINNER"></div>
      </div>`;

    el("koEditor").querySelectorAll('input[data-round]').forEach((inp) => {
      const rid = inp.dataset.round;
      const upd = () => {
        koState[rid] = parseCodes(inp.value);
        el("koEditor").querySelector(`[data-preview="${rid}"]`).innerHTML = koState[rid].map(chip).join("");
      };
      inp.addEventListener("input", upd); upd();
    });
    const wi = el("winnerInput");
    const updW = () => {
      koState.WINNER = wi.value.trim().toUpperCase();
      el("koEditor").querySelector('[data-preview="WINNER"]').innerHTML = koState.WINNER ? chip(koState.WINNER) : "";
    };
    wi.addEventListener("input", updW); updW();
  }
  function roundSize(id) { return { R32: 32, R16: 16, QF: 8, SF: 4, F: 2 }[id]; }

  // ---------- Codes reference ----------
  el("codeList").innerHTML = Object.keys(window.TEAMS).sort()
    .map((c) => `<span class="ko-chip">${flagFor(c)} ${c} · ${esc(teamName(c, { short: true }))}</span>`).join("");

  // ---------- Tabs ----------
  el("tabGroup").onclick = () => { el("tabGroup").classList.add("active"); el("tabKo").classList.remove("active"); el("groupPane").hidden = false; el("koPane").hidden = true; };
  el("tabKo").onclick = () => { el("tabKo").classList.add("active"); el("tabGroup").classList.remove("active"); el("groupPane").hidden = true; el("koPane").hidden = false; };

  // ---------- Save ----------
  el("saveBtn").onclick = async () => {
    const btn = el("saveBtn"); const status = el("saveStatus");
    btn.disabled = true; status.className = ""; status.textContent = "Saving...";
    const payload = {
      groupStage: groupState,
      knockout: {
        R32: koState.R32, R16: koState.R16, QF: koState.QF, SF: koState.SF, F: koState.F,
        WINNER: koState.WINNER || null,
      },
    };
    try {
      const res = await fetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "save failed");
      status.className = "ok";
      status.textContent = `Saved · ${j.groupFinal} group results live`;
    } catch (e) {
      status.className = "err";
      status.textContent = "Couldn't save — is the admin server running? (node scripts/admin-server.js)";
    } finally {
      btn.disabled = false;
    }
  };

  renderGroup();
  renderKo();
})();
