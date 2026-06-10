#!/usr/bin/env node
/**
 * WC26 Quiniela — local admin server.
 *
 * Run this on your machine when you want to enter or correct results by hand:
 *   node scripts/admin-server.js
 * then open http://localhost:8123/admin.html
 *
 * It serves the whole site locally and exposes POST /api/save, which writes your
 * edits to data/overrides.json and regenerates data/results.json (overrides always
 * win over the API layer in data/results.base.json). After editing, commit & push
 * so the deployed site updates.
 *
 * No dependencies. Local use only.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { mergeResults } = require("./merge");

const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "data");
const PORT = process.env.PORT || 8123;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return fallback; }
}

function sendJson(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

function handleSave(req, res) {
  let body = "";
  req.on("data", (c) => { body += c; if (body.length > 1e6) req.destroy(); });
  req.on("end", () => {
    let edits;
    try { edits = JSON.parse(body); } catch { return sendJson(res, 400, { error: "bad JSON" }); }

    // Sanitise into the overrides shape.
    const overrides = {
      note: "Manual corrections that always win over the API. Written by the admin page.",
      groupStage: {},
      knockout: { R32: [], R16: [], QF: [], SF: [], F: [], WINNER: null },
    };
    const gs = edits.groupStage || {};
    for (const id of Object.keys(gs)) {
      const v = gs[id];
      if (Array.isArray(v) && v[0] != null && v[1] != null && v[0] !== "" && v[1] !== "") {
        overrides.groupStage[id] = [Number(v[0]), Number(v[1])];
      }
    }
    const ko = edits.knockout || {};
    for (const r of ["R32", "R16", "QF", "SF", "F"]) {
      if (Array.isArray(ko[r])) {
        overrides.knockout[r] = ko[r].map((s) => String(s).trim().toUpperCase()).filter(Boolean);
      }
    }
    if (ko.WINNER) overrides.knockout.WINNER = String(ko.WINNER).trim().toUpperCase();

    fs.writeFileSync(path.join(DATA, "overrides.json"), JSON.stringify(overrides, null, 2));

    const base = readJson(path.join(DATA, "results.base.json"),
      { groupStage: {}, knockout: { R32: [], R16: [], QF: [], SF: [], F: [], WINNER: null } });
    const merged = mergeResults(base, overrides);
    merged.lastUpdated = new Date().toISOString();
    merged.note = "Generated from results.base.json + overrides.json.";
    fs.writeFileSync(path.join(DATA, "results.json"), JSON.stringify(merged, null, 2));

    sendJson(res, 200, {
      ok: true,
      groupFinal: Object.keys(merged.groupStage).length,
      overrides: Object.keys(overrides.groupStage).length,
    });
  });
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(ROOT, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ""));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end("forbidden"); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
}

http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/save") return handleSave(req, res);
  if (req.method === "GET") return serveStatic(req, res);
  res.writeHead(405); res.end("method not allowed");
}).listen(PORT, () => {
  console.log(`Admin server running:  http://localhost:${PORT}/admin.html`);
  console.log(`(serving ${ROOT})`);
  console.log("Edit results there, then commit & push to update the live site.");
});
