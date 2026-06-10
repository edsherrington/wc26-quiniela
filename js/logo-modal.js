(function () {
  const overlay = document.getElementById("logo-modal");
  const img = document.getElementById("logo-modal-img");
  const label = document.getElementById("logo-modal-label");

  function open(src, name) {
    img.src = src;
    label.textContent = name || "";
    overlay.classList.add("open");
  }
  function close() {
    overlay.classList.remove("open");
    img.src = "";
  }

  overlay.addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  // Event delegation — works for logos injected by any script after load
  document.addEventListener("click", (e) => {
    const el = e.target.closest("img.logo, img.potd-logo");
    if (!el) return;
    const card = el.closest("[data-name]");
    open(el.src, card ? card.dataset.name : "");
  });
})();
