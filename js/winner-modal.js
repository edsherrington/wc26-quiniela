(function () {
  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function makeConfetti(n) {
    const colours = ["#ffd700","#00b861","#ff6b6b","#60a5fa","#f472b6","#a78bfa","#fbbf24"];
    const pieces = [];
    for (let i = 0; i < n; i++) {
      const colour  = colours[i % colours.length];
      const left    = (i / n * 100 + (i % 7) * 3.7) % 100;
      const delay   = (i * 0.17) % 4;
      const dur     = 2.5 + (i % 5) * 0.4;
      const rotate  = i % 2 === 0 ? "confetti-spin-cw" : "confetti-spin-ccw";
      const shape   = i % 3 === 0 ? "border-radius:50%" : i % 3 === 1 ? "" : "border-radius:2px;width:6px;height:14px";
      pieces.push(
        `<div class="cp" style="left:${left.toFixed(1)}%;background:${colour};` +
        `animation:confetti-fall ${dur}s ${delay}s linear infinite,${rotate} ${dur}s ${delay}s linear infinite;${shape}"></div>`
      );
    }
    return pieces.join("");
  }

  window.showWinnerModal = function (winner, rows) {
    if (!winner) return;
    if (sessionStorage.getItem("wc26-winner-seen")) return;

    const top = rows[0];
    if (!top) return;

    const logoHtml = top.entrant.logo
      ? `<img class="wm-logo" src="${esc(top.entrant.logo)}" alt="" />`
      : `<div class="wm-logo wm-logo-placeholder"></div>`;

    const el = document.createElement("div");
    el.id = "winner-modal";
    el.className = "wm-overlay";
    el.innerHTML = `
      <div class="wm-confetti">${makeConfetti(48)}</div>
      <div class="wm-card">
        <div class="wm-trophy">🏆</div>
        ${logoHtml}
        <div class="wm-congratulations">Congratulations!</div>
        <div class="wm-team">${esc(top.entrant.teamName || top.entrant.name)}</div>
        <div class="wm-name">${esc(top.entrant.name)}</div>
        <div class="wm-pts"><span class="wm-pts-n">${top.total}</span><span class="wm-pts-l"> pts</span></div>
        <button class="wm-close">Close</button>
      </div>`;

    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("open"));

    function dismiss() {
      sessionStorage.setItem("wc26-winner-seen", "1");
      el.classList.remove("open");
      setTimeout(() => el.remove(), 350);
    }

    el.querySelector(".wm-close").addEventListener("click", dismiss);
    el.addEventListener("click", e => { if (e.target === el) dismiss(); });
    document.addEventListener("keydown", function h(e) {
      if (e.key === "Escape") { dismiss(); document.removeEventListener("keydown", h); }
    });
  };
})();
