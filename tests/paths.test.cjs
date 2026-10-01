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
  assert.match(serviceWorker, /order-check-shell-v1\.7\.0/);
});

test("la interfaz y el código publican la misma versión", () => {
  assert.match(read("index.html"), /v1\.7\.0/);
  assert.match(read("app.js"), /APP_VERSION = "1\.7\.0"/);
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

test("Todos y Pendientes se ordenan por código; Revisados conserva los más recientes arriba", () => {
  const app = read("app.js");
  assert.match(app, /Number\(a\.code\) - Number\(b\.code\)/);
  assert.match(app, /activeFilter === "reviewed"[\s\S]*?b\.reviewedAt \?\? 0/);
  assert.match(app, /const items = \[\.\.\.displayItems\]\.sort/);
});

test("Display usa almacenamiento separado, botón superior y vista con volver", () => {
  const html = read("index.html");
  const app = read("app.js");
  assert.match(html, /id="display-button"/);
  assert.match(html, /id="display-section"/);
  assert.match(html, /id="display-back-button"/);
  assert.doesNotMatch(html, /id="app-tabs"/);
  assert.match(app, /DISPLAY_STORAGE_KEY = "order-check\.display\.v1"/);
  assert.match(app, /displayItems\.push/);
  assert.match(app, /showDisplayView/);
});

test("Display permite cualquier código válido de 4 dígitos aunque no esté en CGO", () => {
  const app = read("app.js");
  assert.doesNotMatch(app, /Ese código no está en la lista CGO actual/);
});

test("la búsqueda filtra desde el primer dígito y abre detalles solo al tocar una fila", () => {
  const app = read("app.js");
  assert.match(app, /product\.code\.startsWith\(searchQuery\)/);
  assert.match(app, /elements\.searchResult\.hidden = true/);
  assert.match(app, /elements\.checklistSection\.hidden = false/);
  assert.match(app, /showProductDetail\(code\)/);
});

test("los filtros muestran cantidades dinámicas desde la carga inicial", () => {
  const app = read("app.js");
  const html = read("index.html");
  assert.match(app, /all: visit\.products\.length/);
  assert.match(app, /pending: visit\.products\.filter/);
  assert.match(app, /reviewed: visit\.products\.filter/);
  assert.match(app, /button\.textContent =/);
  assert.match(app, /window\.addEventListener\("pageshow"/);
  assert.doesNotMatch(html, /Todos \(0\)/);
  assert.doesNotMatch(html, /Pendientes \(0\)/);
  assert.doesNotMatch(html, /Revisados \(0\)/);
});

test("el encabezado tiene Display a la izquierda y + para nueva visita", () => {
  const html = read("index.html");
  assert.match(html, /id="display-button"[\s\S]*?id="new-visit-button"/);
  assert.match(html, /aria-label="Nueva visita"/);
  assert.match(html, />\s*\+\s*<\/button>/);
});

test("la búsqueda respeta Todos, Pendientes y Revisados", () => {
  const app = read("app.js");
  const filterPosition = app.indexOf('if (activeFilter === "pending")');
  const searchPosition = app.indexOf('if (searchQuery.length > 0)');
  assert.ok(filterPosition >= 0);
  assert.ok(searchPosition > filterPosition);
  assert.match(app, /products = visit\.products\.filter\(\(product\) => !product\.reviewed\)/);
  assert.match(app, /products = visit\.products[\s\S]*?product\.reviewed/);
  assert.match(app, /products = products\.filter\(\(product\) => product\.code\.startsWith\(searchQuery\)\)/);
});

test("la lista principal ya no muestra títulos innecesarios alrededor del buscador", () => {
  const html = read("index.html");
  assert.doesNotMatch(html, /<h2 id="checklist-title">Lista CGO<\/h2>/);
  assert.doesNotMatch(html, /id="loaded-count"/);
  assert.doesNotMatch(html, />Buscar código<\/label>/);
  assert.doesNotMatch(html, /Escribe 1–4 dígitos/);
});

test("los cuatro dígitos del buscador quedan centrados incluso con la X", () => {
  const css = read("styles.css");
  assert.match(css, /\.search-input \{[\s\S]*?padding: 7px 58px;[\s\S]*?text-align: center;/);
});

test("el buscador tiene botón X para limpiar y botón flotante para volver arriba", () => {
  const html = read("index.html");
  const app = read("app.js");
  assert.match(html, /id="clear-search-button"/);
  assert.match(html, /id="scroll-top-button"/);
  assert.match(app, /clearSearchButton\.addEventListener\("click", clearSearchAndRefocus\)/);
  assert.match(app, /window\.addEventListener\("scroll", syncScrollTopButton/);
  assert.match(app, /window\.scrollTo\(\{ top: 0/);
});

test("la mayor parte de cada fila marca el checkbox y el acceso a detalles queda a la izquierda", () => {
  const app = read("app.js");
  const css = read("styles.css");
  assert.match(app, /detailsButton\.append\(chevron\)/);
  assert.match(app, /checkControl\.append\(content, checkbox\)/);
  assert.match(app, /rowMain\.append\(detailsButton, checkControl\)/);
  assert.match(css, /grid-template-columns: 48px minmax\(0, 1fr\)/);
  assert.match(css, /\.code-checkbox \{[\s\S]*?width: 30px;[\s\S]*?margin: 0 0 0 auto;/);
});

test("en iOS marcar un checkbox durante una búsqueda mantiene el teclado abierto", () => {
  const app = read("app.js");
  assert.match(app, /toggleSearchCheckboxBeforeBlur/);
  assert.match(app, /codeList\.addEventListener\("touchstart", toggleSearchCheckboxBeforeBlur, \{ passive: false \}\)/);
  assert.match(app, /codeList\.addEventListener\("mousedown", toggleSearchCheckboxBeforeBlur\)/);
  assert.match(app, /event\.preventDefault\(\)/);
  assert.match(app, /setReviewed\(code, !product\.reviewed\)/);
  assert.match(app, /elements\.searchInput\.focus\(\{ preventScroll: true \}\)/);
});

test("en iOS el resultado se abre al inicio del toque para evitar que el buscador pierda foco", () => {
  const app = read("app.js");
  assert.match(app, /preserveSearchKeyboardOnNextDetail/);
  assert.match(app, /codeList\.addEventListener\("touchstart", openSearchResultBeforeBlur, \{ passive: false \}\)/);
  assert.match(app, /codeList\.addEventListener\("mousedown", openSearchResultBeforeBlur\)/);
  assert.match(app, /event\.preventDefault\(\)/);
  assert.match(app, /showProductDetail\(code\)/);
  assert.match(app, /elements\.searchCard\.hidden = !keepSearchKeyboard/);
  assert.match(app, /elements\.searchInput\.focus\(\{ preventScroll: true \}\)/);
});

test("el encabezado ya no muestra X de X revisados", () => {
  const html = read("index.html");
  const app = read("app.js");
  assert.doesNotMatch(html, /id="progress-text"/);
  assert.doesNotMatch(app, /progressText/);
});

test("la lista de prueba no está precargada en producción", () => {
  const productionFiles = ["index.html", "core.js", "app.js", "service-worker.js"].map(read).join("\n");
  assert.doesNotMatch(productionFiles, /3984/);
  assert.doesNotMatch(productionFiles, /6144/);
});
