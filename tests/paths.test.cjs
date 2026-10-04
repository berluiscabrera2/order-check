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
  assert.match(serviceWorker, /order-check-shell-/);
  assert.match(serviceWorker, /v1\.10\.3/);
  assert.match(serviceWorker, /fetch\(asset, \{ cache: "reload" \}\)/);
});

test("la interfaz y el código publican la misma versión", () => {
  assert.match(read("index.html"), /v1\.10\.3/);
  assert.match(read("app.js"), /APP_VERSION = "1\.10\.3"/);
});

test("las filas ofrecen navegación accesible a detalles y regreso a la lista", () => {
  const html = read("index.html");
  const app = read("app.js");
  assert.match(html, /id="product-detail-view"/);
  assert.match(html, /id="detail-back-button"/);
  assert.match(html, /Volver a la lista/);
  assert.match(app, /data-details-key/);
  assert.match(app, /history\.pushState/);
  assert.match(app, /addEventListener\("popstate"/);
});

test("los detalles incluyen metadatos INV y CGO QTY sin cambiar la búsqueda por código", () => {
  const html = read("index.html");
  const app = read("app.js");
  assert.match(html, /id="detail-inv"/);
  assert.match(html, /id="detail-cgo-qty"/);
  assert.match(app, /findProduct\(key\)/);
  assert.match(app, /keyForProduct\(product\) === key/);
});

test("la lista usa el selector puro de orden y Revisados conserva los más recientes arriba", () => {
  const app = read("app.js");
  assert.match(app, /core\.selectProducts\(productsForActiveDay\(\)/);
  assert.match(app, /core\.nextReviewedAt\(visit\.products\)/);
  assert.match(app, /const items = \[\.\.\.activeWarehouseItems\(\)\]\.sort/);
});

test("Warehouse contiene tabs Display y Aísles con almacenamiento independiente", () => {
  const html = read("index.html");
  const app = read("app.js");
  assert.match(html, /id="warehouse-button"[^>]*>Warehouse<\/button>/);
  assert.match(html, /id="warehouse-section"/);
  assert.match(html, /id="warehouse-back-button"/);
  assert.match(html, /data-warehouse-tab="display"[\s\S]*?>\s*Display\s*<\/button>/);
  assert.match(html, /data-warehouse-tab="aisles"[\s\S]*?>\s*Aísles\s*<\/button>/);
  assert.match(app, /DISPLAY_STORAGE_KEY = "order-check\.display\.v1"/);
  assert.match(app, /AISLES_STORAGE_KEY = "order-check\.aisles\.v1"/);
  assert.match(app, /warehouseItems = visit[\s\S]*?display: loadWarehouseItems\(DISPLAY_STORAGE_KEY\)[\s\S]*?aisles: loadWarehouseItems\(AISLES_STORAGE_KEY\)/);
  assert.match(app, /function showWarehouseView\(\)/);
  assert.match(app, /saveWarehouseItems\(\)/);
});

test("Warehouse permite cualquier código válido de 4 dígitos aunque no esté en CGO", () => {
  const app = read("app.js");
  assert.doesNotMatch(app, /Ese código no está en la lista CGO actual/);
});

test("las operaciones de Warehouse afectan únicamente la lista activa", () => {
  const app = read("app.js");
  assert.match(app, /function activeWarehouseItems\(\)[\s\S]*?warehouseItems\[activeWarehouseTab\]/);
  assert.match(app, /warehouseItems\[activeWarehouseTab\] = activeWarehouseItems\(\)\.filter/);
  assert.match(app, /tab === "aisles" \? AISLES_STORAGE_KEY : DISPLAY_STORAGE_KEY/);
  assert.match(app, /localStorage\.removeItem\(DISPLAY_STORAGE_KEY\);[\s\S]*?localStorage\.removeItem\(AISLES_STORAGE_KEY\);/);
});

test("los campos de cantidad de Warehouse anuncian la lista activa y el código", () => {
  const app = read("app.js");
  assert.match(app, /setAttribute\("aria-label", `Cantidad de \$\{label\} para \$\{item\.code\}`\)/);
  assert.match(app, /const codeLabel = document\.createElement\("span"\)/);
  assert.doesNotMatch(app, /const label = document\.createElement\("span"\)/);
});

test("la búsqueda filtra las filas y reserva CGO, INV y QTY para los detalles", () => {
  const html = read("index.html");
  const app = read("app.js");
  assert.match(read("core.js"), /product\?\.code\?\.startsWith\(searchQuery\)/);
  assert.doesNotMatch(html, /id="search-result"/);
  assert.doesNotMatch(app, /resultAction|resultTitle|resultMessage/);
  assert.match(app, /function renderSearchList\(\)/);
  assert.match(app, /showProductDetail\(key\)/);
  assert.match(html, /id="product-detail-view"/);
  assert.match(html, /id="detail-inv"/);
  assert.match(html, /id="detail-cgo-qty"/);
});

test("los filtros muestran cantidades dinámicas desde la carga inicial", () => {
  const app = read("app.js");
  const html = read("index.html");
  assert.match(app, /all: dayProducts\.length/);
  assert.match(app, /pending: dayProducts\.filter/);
  assert.match(app, /reviewed: dayProducts\.filter/);
  assert.match(app, /button\.textContent =/);
  assert.match(app, /window\.addEventListener\("pageshow"/);
  assert.doesNotMatch(html, /Todos \(0\)/);
  assert.doesNotMatch(html, /Pendientes \(0\)/);
  assert.doesNotMatch(html, /Revisados \(0\)/);
});

test("el encabezado tiene Warehouse a la izquierda y + para nueva visita", () => {
  const html = read("index.html");
  assert.match(html, /id="warehouse-button"[\s\S]*?id="new-visit-button"/);
  assert.match(html, /aria-label="Nueva visita"/);
  assert.match(html, />\s*\+\s*<\/button>/);
});

test("la búsqueda usa toda la lista del día y no queda limitada por el filtro activo", () => {
  const core = read("core.js");
  const searchPosition = core.indexOf("if (searchQuery)");
  const pendingPosition = core.indexOf('else if (filter === "pending")');
  assert.ok(searchPosition >= 0);
  assert.ok(pendingPosition > searchPosition);
  assert.match(core, /if \(searchQuery\)[\s\S]*?else if \(filter === "pending"\)/);
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

test("Enter procesa resultados de arriba hacia abajo sin doble avance", () => {
  const html = read("index.html");
  const app = read("app.js");
  const css = read("styles.css");
  assert.match(html, /id="search-enter-button"/);
  assert.match(html, /enterkeyhint="go"/);
  assert.match(app, /function getSearchEnterSequence\(\)/);
  assert.match(app, /core\.createSelectionSequence\(filteredProducts\(\)\)/);
  assert.match(app, /function submitNextSearchResult\(\)/);
  assert.match(app, /core\.takeNextSelectionKey\(sequence\.queue\)/);
  assert.match(app, /setReviewed\(key, true\)/);
  assert.match(app, /core\.selectionSequenceComplete\(sequence\.queue\)/);
  assert.match(app, /clearSearch\(\{ refocus: true \}\)/);
  assert.match(app, /event\.type !== "touchstart"[\s\S]*?directSubmittedSearchAt < 1200/);
  assert.match(app, /event\.repeat/);
  assert.match(app, /visualViewport\.addEventListener\("resize", updateKeyboardInset\)/);
  assert.match(css, /\.search-enter-button \{[\s\S]*?position: fixed;[\s\S]*?right:/);
  assert.match(css, /background: var\(--blue\)/);
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

test("marcar un checkbox limpia la búsqueda y en iOS mantiene el teclado abierto", () => {
  const app = read("app.js");
  assert.match(app, /toggleSearchCheckboxBeforeBlur/);
  assert.match(app, /codeList\.addEventListener\("touchstart", toggleSearchCheckboxBeforeBlur, \{ passive: false \}\)/);
  assert.match(app, /codeList\.addEventListener\("mousedown", toggleSearchCheckboxBeforeBlur\)/);
  assert.match(app, /event\.preventDefault\(\)/);
  assert.match(app, /setReviewed\(key, !product\.reviewed\)/);
  assert.match(app, /clearSearch\(\{ refocus: true \}\)/);
  assert.match(app, /const hadSearch = elements\.searchInput\.value\.length > 0;[\s\S]*?setReviewed\(key, checkbox\.checked\);[\s\S]*?clearSearch\(\);/);
  assert.match(app, /directToggledCheckbox === checkbox/);
  assert.match(app, /directToggledCheckbox = checkbox/);
  assert.doesNotMatch(app, /directToggledCheckbox\?\.code/);
});

test("en iOS el resultado se abre al inicio del toque para evitar que el buscador pierda foco", () => {
  const app = read("app.js");
  assert.match(app, /preserveSearchKeyboardOnNextDetail/);
  assert.match(app, /codeList\.addEventListener\("touchstart", openSearchResultBeforeBlur, \{ passive: false \}\)/);
  assert.match(app, /codeList\.addEventListener\("mousedown", openSearchResultBeforeBlur\)/);
  assert.match(app, /event\.preventDefault\(\)/);
  assert.match(app, /showProductDetail\(key\)/);
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


test("DAY usa CODE + DAY como identidad sin colisiones entre días", () => {
  const app = read("app.js");
  const html = read("index.html");
  assert.match(html, /Código \| INV \| CGO QTY \| DAY/);
  assert.match(app, /function keyForProduct\(product\)/);
  assert.match(app, /checkbox\.dataset\.productKey/);
  assert.match(app, /detailsButton\.dataset\.detailsKey/);
  assert.match(app, /selectedProductKey/);
});

test("el filtro de día es un icono compacto junto a Warehouse y abre un menú", () => {
  const html = read("index.html");
  const app = read("app.js");
  const css = read("styles.css");
  assert.match(html, /id="warehouse-button"[\s\S]*?id="day-filter-button"[\s\S]*?id="new-visit-button"/);
  assert.match(html, /id="day-filter-menu"/);
  assert.match(app, /function renderDayMenu\(\)/);
  assert.match(app, /activeDay = button\.dataset\.day/);
  assert.match(app, /function productsForActiveDay\(\)/);
  assert.match(app, /const dayProducts = productsForActiveDay\(\)/);
  assert.match(css, /\.day-filter-menu \{[\s\S]*?position: absolute/);
});

test("el encabezado incluye selector de orden original, ascendente y descendente", () => {
  const html = read("index.html");
  const app = read("app.js");
  assert.match(html, /id="sort-button"/);
  assert.match(html, /id="sort-menu"/);
  assert.match(app, /\["original", "Original"\]/);
  assert.match(app, /\["ascending", "Ascendente"\]/);
  assert.match(app, /\["descending", "Descendente"\]/);
  assert.match(app, /activeSortMode = button\.dataset\.sortMode/);
});

test("la lista no muestra las palabras Revisado/Pendiente en cada fila y muestra DAY", () => {
  const app = read("app.js");
  assert.doesNotMatch(app, /state\.textContent = product\.reviewed \? "Revisado" : "Pendiente"/);
  assert.match(app, /day\.className = "code-day"/);
  assert.match(app, /day\.textContent = product\.day/);
});

test("el título visible usa emojis editables y limita a máximo 3", () => {
  const html = read("index.html");
  const app = read("app.js");
  assert.doesNotMatch(html, /<h1 id="visit-title">Order Check<\/h1>/);
  assert.match(html, /id="emoji-title-button"/);
  assert.match(html, /🚀👾/);
  assert.match(app, /TITLE_STORAGE_KEY/);
  assert.match(app, /parts\.length < 1 \|\| parts\.length > 3/);
  assert.match(app, /localStorage\.setItem\(TITLE_STORAGE_KEY, normalized\)/);
});

test("Enter mantiene CODE + DAY como filas independientes", () => {
  const app = read("app.js");
  assert.match(app, /core\.createSelectionSequence\(filteredProducts\(\)\)/);
  assert.match(app, /core\.takeNextSelectionKey\(sequence\.queue\)/);
  assert.match(app, /searchEnterSequence\.day !== activeDay/);
});


test("los emojis quedan a la izquierda y los controles a la derecha", () => {
  const html = read("index.html");
  const header = html.match(/<header id="visit-header"[\s\S]*?<\/header>/)?.[0] ?? "";
  assert.ok(header.indexOf('id="emoji-title-button"') >= 0);
  assert.ok(header.indexOf('id="emoji-title-button"') < header.indexOf('class="visit-actions"'));
});
