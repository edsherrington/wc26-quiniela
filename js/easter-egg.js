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

  let tapCount = 0;
  let tapTimer = null;
  let deck = [];

  function nextFromDeck() {
    if (!deck.length) {
      // Refill and shuffle
      deck = SEQUENCE.map((_, i) => i);
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }
    return deck.pop();
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

  function showSlide(i) {
    const item = SEQUENCE[i];
    const overlay = document.createElement("div");
    overlay.className = "ee-overlay";

    if (item.type === "gif") {
      overlay.innerHTML = `<img class="ee-img" src="${item.src}" alt="" />`;
    } else {
      overlay.innerHTML = `<div class="ee-text">${item.text}</div>`;
    }

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
})();
