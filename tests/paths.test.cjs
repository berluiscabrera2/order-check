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
  assert.match(serviceWorker, /order-check-shell-v1\.3\.0/);
});

test("la interfaz y el código publican la misma versión", () => {
  assert.match(read("index.html"), /v1\.3\.0/);
  assert.match(read("app.js"), /APP_VERSION = "1\.3\.0"/);
});

test("las filas ofrecen navegación accesible a detalles y regreso a la lista", () => {
  const html = read("index.html");
  const app = read("app.js");
  assert.match(html, /id="product-detail-view"/);
  assert.match(html, /id="detail-back-button"/);
  assert.match(html, /Volver a la lista/);
  assert.match(app, /data-details-code/);
  assert.match(app, /history\.pushState/);
  assert.match(app, /addEventListener\("popstate"/);
});

test("la interfaz incluye metadatos INV y CGO QTY sin cambiar la búsqueda por código", () => {
  const html = read("index.html");
  const app = read("app.js");
  assert.match(html, /id="result-inv"/);
  assert.match(html, /id="result-cgo-qty"/);
  assert.match(app, /findProduct\(code\)/);
  assert.match(app, /product\.code === code/);
});

test("Revisados ordena primero los productos marcados más recientemente", () => {
  const app = read("app.js");
  assert.match(app, /reviewedAt = Date\.now\(\)/);
  assert.match(app, /b\.reviewedAt \?\? 0/);
});

test("Display usa almacenamiento separado y no modifica la lista CGO", () => {
  const html = read("index.html");
  const app = read("app.js");
  assert.match(html, /data-app-tab="display"/);
  assert.match(html, /id="display-section"/);
  assert.match(app, /DISPLAY_STORAGE_KEY = "order-check\.display\.v1"/);
  assert.match(app, /displayItems\.push/);
});

test("la lista de prueba no está precargada en producción", () => {
  const productionFiles = ["index.html", "core.js", "app.js", "service-worker.js"].map(read).join("\n");
  assert.doesNotMatch(productionFiles, /3984/);
  assert.doesNotMatch(productionFiles, /6144/);
});
