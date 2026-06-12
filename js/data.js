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

  // Kick-offs are stored as hardcoded BST (e.g. "2026-06-15T00:00:00+01:00"). The string
  // is a correct absolute instant (+01:00), so the two views split cleanly:
  //  - MATCH DAY = the US Eastern calendar date of that instant, so a game that kicks off
  //    after midnight UK time stays on the same match day as the earlier US games.
  //  - KICK-OFF TIME = the BST clock time, read straight off the string (see kickoffTime).
  function dayKey(iso) {
    if (!iso) return "";
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(iso));
  }

  function kickoffTime(iso) {
    if (!iso) return "";
    // Stored in BST — read the HH:MM straight off the string (no conversion).
    return iso.slice(11, 16);
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
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
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
