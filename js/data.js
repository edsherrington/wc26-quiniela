// Loads the three JSON files and exposes helpers. Used by both pages.
(function () {
  async function loadAll() {
    const bust = "?v=" + Date.now(); // avoid stale caches while iterating
    const [fixtures, predictions, results] = await Promise.all([
      fetch("data/fixtures.json" + bust).then((r) => r.json()),
      fetch("data/predictions.json" + bust).then((r) => r.json()),
      fetch("data/results.json" + bust).then((r) => r.json()),
    ]);
    return { fixtures, predictions, results };
  }

  // YYYY-MM-DD straight from the ISO string (no timezone math, so the day never shifts).
  function dayKey(iso) {
    return (iso || "").split("T")[0];
  }

  function kickoffTime(iso) {
    const t = (iso || "").split("T")[1] || "";
    return t.slice(0, 5); // HH:MM
  }

  function prettyDate(dayKeyStr) {
    const [y, m, d] = dayKeyStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString("en-GB", {
      weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
    });
  }

  // Sorted list of unique match days across the group stage.
  function matchDays(fixtures) {
    const set = new Set(fixtures.groupStage.map((f) => dayKey(f.kickoff)));
    return Array.from(set).sort();
  }

  function fixturesOnDay(fixtures, day) {
    return fixtures.groupStage
      .filter((f) => dayKey(f.kickoff) === day)
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  }

  function todayKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Default day to show: today if it has matches, else the next upcoming day,
  // else the last day of the tournament.
  function defaultDay(fixtures) {
    const days = matchDays(fixtures);
    const today = todayKey();
    if (days.includes(today)) return today;
    const upcoming = days.find((d) => d >= today);
    return upcoming || days[days.length - 1];
  }

  function isFinal(fx, results) {
    const r = results.groupStage[fx.id];
    return !!(r && r[0] != null && r[1] != null);
  }

  window.WC = {
    loadAll, dayKey, kickoffTime, prettyDate, matchDays,
    fixturesOnDay, todayKey, defaultDay, isFinal,
  };
})();
