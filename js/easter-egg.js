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
  let lastIndex = -1;

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
      // Pick a random index, avoiding the same one twice in a row
      let i;
      do { i = Math.floor(Math.random() * SEQUENCE.length); } while (i === lastIndex && SEQUENCE.length > 1);
      lastIndex = i;
      showSlide(i);
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
