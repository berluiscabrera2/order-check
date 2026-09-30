"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("manifest usa el project site /order-check/", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.id, "/order-check/");
  assert.equal(manifest.start_url, "/order-check/");
  assert.equal(manifest.scope, "/order-check/");
  for (const icon of manifest.icons) {
    assert.match(icon.src, /^\/order-check\/icons\//);
  }
});

test("HTML referencia recursos bajo /order-check/", () => {
  const html = read("index.html");
  const resourcePaths = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  for (const resourcePath of resourcePaths) {
    assert.match(resourcePath, /^\/order-check\//);
  }
});

test("service worker limita su caché y scope a /order-check/", () => {
  const serviceWorker = read("service-worker.js");
  assert.match(serviceWorker, /APP_ROOT = "\/order-check\/"/);
  assert.match(serviceWorker, /order-check-shell-v1\.0\.0/);
});

test("la lista de prueba no está precargada en producción", () => {
  const productionFiles = ["index.html", "core.js", "app.js", "service-worker.js"].map(read).join("\n");
  assert.doesNotMatch(productionFiles, /3984/);
  assert.doesNotMatch(productionFiles, /6144/);
});
