#!/usr/bin/env node
"use strict";
var fs = require("fs");
var path = require("path");
var dir = __dirname;
var jsonPath = path.join(dir, "classicgamezone-games.json");
var htmlPath = path.join(dir, "retro.html");
try {
  var json = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  var arr = Array.isArray(json) ? json : (json.games || json.list || []);
  var html = fs.readFileSync(htmlPath, "utf8");
  var raw = JSON.stringify(arr);
  var escaped = raw.replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  var replacement = "<script id=\"retro-games-json\" type=\"application/json\">" + escaped + "</script>";
  var before = html.length;
  html = html.replace(/<script id="retro-games-json" type="application\/json">\[\]<\/script>/, replacement);
  if (html.length === before) throw new Error("Placeholder not found in retro.html");
  fs.writeFileSync(htmlPath, html);
  console.log("Inlined " + arr.length + " games into retro.html");
} catch (e) {
  console.error("Build failed:", e.message || e);
  process.exit(1);
}
