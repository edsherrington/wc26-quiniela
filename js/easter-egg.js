(function () {
  const SEQUENCE = [
    { type: "gif",  src: "assets/easter/ee-1.gif" },
    { type: "gif",  src: "assets/easter/ee-2.gif" },
    { type: "gif",  src: "assets/easter/ee-3.gif" },
    { type: "text", text: "RIW" },
    { type: "gif",  src: "assets/easter/ee-4.gif" },
    { type: "gif",  src: "assets/easter/ee-5.gif" },
    { type: "gif",  src: "assets/easter/ee-6.gif" },
    { type: "gif",  src: "assets/easter/ee-7.gif" },
  ];

  const GIF_INDICES = SEQUENCE.reduce((acc, item, i) => {
    if (item.type === "gif") acc.push(i);
    return acc;
  }, []);

  let tapCount = 0;
  let tapTimer = null;

  function loadDeck() {
    try { return JSON.parse(sessionStorage.getItem("ee-deck") || "[]"); } catch { return []; }
  }
  function saveDeck(d) {
    try { sessionStorage.setItem("ee-deck", JSON.stringify(d)); } catch {}
  }
  function nextFromDeck() {
    let deck = loadDeck();
    if (!deck.length) {
      deck = SEQUENCE.map((_, i) => i);
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }
    const next = deck.pop();
    saveDeck(deck);
    return next;
  }

  const banner = document.querySelector(".topbar-image");
  if (!banner) return;

  banner.style.cursor = "pointer";

  banner.addEventListener("click", function () {
    tapCount++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { tapCount = 0; }, 1800);

    if (tapCount >= 5) {
      tapCount = 0;
      clearTimeout(tapTimer);
      showSlide(nextFromDeck());
    }
  });

  function showSlide(i, caption) {
    const item = SEQUENCE[i];
    const overlay = document.createElement("div");
    overlay.className = "ee-overlay";

    let inner = "";
    if (item.type === "gif") {
      inner = `<img class="ee-img" src="${item.src}" alt="" />`;
    } else {
      inner = `<div class="ee-text">${item.text}</div>`;
    }
    if (caption) {
      inner += `<div class="ee-caption">${caption}</div>`;
    }
    overlay.innerHTML = inner;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("open"));

    let dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      overlay.classList.remove("open");
      setTimeout(() => overlay.remove(), 250);
      document.removeEventListener("keydown", onKey);
    }

    const autoTimer = setTimeout(dismiss, 3500);

    overlay.addEventListener("click", () => { clearTimeout(autoTimer); dismiss(); });

    function onKey(e) { if (e.key === "Escape") { clearTimeout(autoTimer); dismiss(); } }
    document.addEventListener("keydown", onKey);
  }

  // Called by index.js when navigating to an England match day.
  // Shows a random GIF (never RIW) once per calendar day per visitor (localStorage).
  window.EasterEgg = {
    showEnglandDay: function (dateKey) {
      const storageKey = "ee-eng-" + dateKey;
      try { if (localStorage.getItem(storageKey)) return; } catch {}
      const idx = GIF_INDICES[Math.floor(Math.random() * GIF_INDICES.length)];
      showSlide(idx, "Match day! 🏴󠁧󠁢󠁥󠁮󠁧󠁿");
      try { localStorage.setItem(storageKey, "1"); } catch {}
    },
  };
})();
