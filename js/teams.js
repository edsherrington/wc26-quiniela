// FIFA 3-letter code -> { name, short, iso2 }. Flags are derived from iso2 at runtime.
// England & Scotland use subdivision flags (handled in flagFor).
window.TEAMS = {
  ALG: { name: "Algeria", short: "Algeria", iso2: "DZ" },
  ARG: { name: "Argentina", short: "Argentina", iso2: "AR" },
  AUS: { name: "Australia", short: "Australia", iso2: "AU" },
  AUT: { name: "Austria", short: "Austria", iso2: "AT" },
  BEL: { name: "Belgium", short: "Belgium", iso2: "BE" },
  BIH: { name: "Bosnia and Herzegovina", short: "Bosnia", iso2: "BA" },
  BRA: { name: "Brazil", short: "Brazil", iso2: "BR" },
  CAN: { name: "Canada", short: "Canada", iso2: "CA" },
  CIV: { name: "Côte d'Ivoire", short: "Ivory Coast", iso2: "CI" },
  COD: { name: "DR Congo", short: "DR Congo", iso2: "CD" },
  COL: { name: "Colombia", short: "Colombia", iso2: "CO" },
  CPV: { name: "Cape Verde", short: "Cape Verde", iso2: "CV" },
  CRO: { name: "Croatia", short: "Croatia", iso2: "HR" },
  CUW: { name: "Curaçao", short: "Curaçao", iso2: "CW" },
  CZE: { name: "Czechia", short: "Czechia", iso2: "CZ" },
  ECU: { name: "Ecuador", short: "Ecuador", iso2: "EC" },
  EGY: { name: "Egypt", short: "Egypt", iso2: "EG" },
  ENG: { name: "England", short: "England", iso2: "GB-ENG" },
  ESP: { name: "Spain", short: "Spain", iso2: "ES" },
  FRA: { name: "France", short: "France", iso2: "FR" },
  GER: { name: "Germany", short: "Germany", iso2: "DE" },
  GHA: { name: "Ghana", short: "Ghana", iso2: "GH" },
  HAI: { name: "Haiti", short: "Haiti", iso2: "HT" },
  IRN: { name: "Iran", short: "Iran", iso2: "IR" },
  IRQ: { name: "Iraq", short: "Iraq", iso2: "IQ" },
  JOR: { name: "Jordan", short: "Jordan", iso2: "JO" },
  JPN: { name: "Japan", short: "Japan", iso2: "JP" },
  KOR: { name: "Korea Republic", short: "S. Korea", iso2: "KR" },
  KSA: { name: "Saudi Arabia", short: "Saudi Arabia", iso2: "SA" },
  MAR: { name: "Morocco", short: "Morocco", iso2: "MA" },
  MEX: { name: "Mexico", short: "Mexico", iso2: "MX" },
  NED: { name: "Netherlands", short: "Netherlands", iso2: "NL" },
  NOR: { name: "Norway", short: "Norway", iso2: "NO" },
  NZL: { name: "New Zealand", short: "New Zealand", iso2: "NZ" },
  PAN: { name: "Panama", short: "Panama", iso2: "PA" },
  PAR: { name: "Paraguay", short: "Paraguay", iso2: "PY" },
  POR: { name: "Portugal", short: "Portugal", iso2: "PT" },
  QAT: { name: "Qatar", short: "Qatar", iso2: "QA" },
  RSA: { name: "South Africa", short: "South Africa", iso2: "ZA" },
  SCO: { name: "Scotland", short: "Scotland", iso2: "GB-SCT" },
  SEN: { name: "Senegal", short: "Senegal", iso2: "SN" },
  SUI: { name: "Switzerland", short: "Switzerland", iso2: "CH" },
  SWE: { name: "Sweden", short: "Sweden", iso2: "SE" },
  TUN: { name: "Tunisia", short: "Tunisia", iso2: "TN" },
  TUR: { name: "Türkiye", short: "Türkiye", iso2: "TR" },
  URU: { name: "Uruguay", short: "Uruguay", iso2: "UY" },
  USA: { name: "USA", short: "USA", iso2: "US" },
  UZB: { name: "Uzbekistan", short: "Uzbekistan", iso2: "UZ" },
};

// Subdivision flags that the regional-indicator trick can't produce.
const SUBDIVISION_FLAGS = {
  "GB-ENG": "🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
  "GB-SCT": "🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
};

window.flagFor = function (code) {
  const t = window.TEAMS[code];
  if (!t) return "🏳️";
  if (SUBDIVISION_FLAGS[t.iso2]) return SUBDIVISION_FLAGS[t.iso2];
  const base = 0x1f1e6;
  const cc = t.iso2.toUpperCase();
  return String.fromCodePoint(base + (cc.charCodeAt(0) - 65), base + (cc.charCodeAt(1) - 65));
};

window.teamName = function (code, opts) {
  const t = window.TEAMS[code];
  if (!t) return code;
  return opts && opts.short ? t.short : t.name;
};
