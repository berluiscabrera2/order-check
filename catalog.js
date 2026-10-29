(function () {
  "use strict";
  const core = window.OrderCatalogCore;
  const view = document.querySelector("#catalog-view");
  const content = document.querySelector("#catalog-content");
  const detail = document.querySelector("#catalog-detail");
  const detailContent = document.querySelector("#catalog-detail-content");
  const list = document.querySelector("#catalog-list");
  const search = document.querySelector("#catalog-search");
  const category = document.querySelector("#catalog-category");
  const photos = document.querySelector("#catalog-photos");
  const favorites = document.querySelector("#catalog-favorites");
  const more = document.querySelector("#catalog-more");
  const status = document.querySelector("#catalog-import-status");
  const exportButton = document.querySelector("#catalog-export");
  let products = [], matches = [], shown = 0, listScroll = 0, returnToOrder = null, detailFromOrder = false;
  const byCode = new Map();

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("order-check.catalog", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("products", { keyPath: "codigo" });
        db.createObjectStore("meta");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function readProducts() {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const request = db.transaction("products").objectStore("products").getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  }
  async function writeProducts(next) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(["products", "meta"], "readwrite");
        const store = tx.objectStore("products");
        store.clear();
        next.forEach((item) => store.put(item));
        tx.objectStore("meta").put(new Date().toISOString(), "lastImport");
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }
  async function writeFavorite(item) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction("products", "readwrite");
        tx.objectStore("products").put(item);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  }
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function display(value) { return value || "—"; }
  function photo(item, large = false) {
    const wrap = el("div", large ? "catalog-photo catalog-photo--large" : "catalog-photo");
    const placeholder = el("span", "catalog-placeholder", "Sin foto");
    wrap.append(placeholder);
    const imageUrl = core.imageUrlForProduct(item);
    if (imageUrl) {
      placeholder.setAttribute("aria-hidden", "true");
      const image = el("img");
      image.src = imageUrl;
      image.alt = `Fotografía de ${display(item.nombre_oficial_goya || item.descripcion_pdf)}`;
      image.loading = large ? "eager" : "lazy";
      image.decoding = "async";
      image.onerror = () => { image.remove(); placeholder.removeAttribute("aria-hidden"); };
      wrap.append(image);
    }
    return wrap;
  }
  function rebuildIndex() {
    byCode.clear(); products.forEach((p) => byCode.set(p.codigo, p));
    const previous = category.value;
    category.replaceChildren(new Option("Todas", ""));
    [...new Set(products.map((p) => p.seccion_pdf).filter(Boolean))].sort((a, b) => a.localeCompare(b)).forEach((name) => category.add(new Option(name, name)));
    category.value = previous;
    content.hidden = !products.length || !detail.hidden;
    exportButton.hidden = !products.length;
    if (!products.length) status.textContent = "Importa tu catálogo privado desde Archivos. No se sube a ningún servidor.";
    renderList();
  }
  function appendRows() {
    const slice = matches.slice(shown, shown + 80);
    const fragment = document.createDocumentFragment();
    slice.forEach((item) => {
      const li = el("li");
      const button = el("button", "catalog-row");
      button.type = "button";
      button.dataset.code = item.codigo;
      button.append(photo(item));
      const copy = el("span", "catalog-row-copy");
      copy.append(el("strong", "", `${item.codigo} · ${display(item.nombre_oficial_goya || item.descripcion_pdf)}`));
      copy.append(el("small", "", `${display(item.medida_pdf)} · Caja ${display(item.unidades_por_caja_pdf)} · SUGG RETAIL ${item.sugg_retail_pdf_usd_por_producto ? `$${item.sugg_retail_pdf_usd_por_producto}` : "—"}`));
      if (core.imageNeedsReview(item)) copy.append(el("small", "", "Imagen por verificar"));
      button.append(copy, el("span", "catalog-chevron", "›"));
      li.append(button); fragment.append(li);
    });
    list.append(fragment);
    shown += slice.length;
    more.hidden = shown >= matches.length;
  }
  function renderList() {
    matches = core.filterProducts(products, { query: search.value, category: category.value, photos: photos.checked, favorites: favorites.checked });
    shown = 0; list.replaceChildren();
    document.querySelector("#catalog-count").textContent = `${matches.length} de ${products.length} productos`;
    appendRows();
  }
  function line(label, value) {
    const row = el("p", "catalog-detail-line");
    row.append(el("strong", "", `${label}: `), document.createTextNode(display(value)));
    return row;
  }
  function showDetail(code, fromOrder = false) {
    listScroll = fromOrder ? listScroll : window.scrollY;
    detailFromOrder = fromOrder;
    content.hidden = true; detail.hidden = false;
    detailContent.replaceChildren();
    const item = byCode.get(code);
    if (!item) {
      detailContent.append(el("h2", "", code), el("p", "", "Este código todavía no está en el catálogo."));
    } else {
      detailContent.append(photo(item, true));
      if (core.imageNeedsReview(item)) detailContent.append(el("p", "catalog-image-warning", "Imagen por verificar: el código no figura en el nombre del archivo."));
      detailContent.append(el("h2", "", `${item.codigo} · ${display(item.nombre_oficial_goya || item.descripcion_pdf)}`));
      if (item.descripcion_oficial_goya) detailContent.append(line("Descripción oficial", item.descripcion_oficial_goya));
      detailContent.append(line("Descripción de lista", item.descripcion_pdf), line("Categoría", item.seccion_pdf), line("Medida", item.medida_pdf), line("Unidades por caja", item.unidades_por_caja_pdf));
      detailContent.append(line("SUGG RETAIL · por envase", item.sugg_retail_pdf_usd_por_producto ? `$${item.sugg_retail_pdf_usd_por_producto}` : ""));
      detailContent.append(line("UNIT PRICE · referencia por lb/pt (verificar unidad)", item.unit_price_pdf_usd_por_peso_o_volumen ? `$${item.unit_price_pdf_usd_por_peso_o_volumen}` : ""));
      detailContent.append(line("Fuente", "Lista PDF, páginas 1–24"));
      detailContent.append(line("Vigencia histórica · verificar precio", `${display(item.fecha_inicio_lista)} a ${display(item.fecha_fin_lista)}`));
      if (item.revisar) detailContent.append(line("Pendiente de revisión", item.revisar));
      if (item.url_ficha_goya) {
        const link = el("a", "button button--quiet", "Abrir ficha oficial de Goya");
        link.href = item.url_ficha_goya; link.target = "_blank"; link.rel = "noopener noreferrer";
        detailContent.append(link);
      }
      const favorite = el("button", "button button--quiet", item.favorite ? "★ Quitar favorito" : "☆ Favorito");
      favorite.type = "button";
      favorite.addEventListener("click", async () => {
        item.favorite = !item.favorite;
        try { await writeFavorite(item); favorite.textContent = item.favorite ? "★ Quitar favorito" : "☆ Favorito"; }
        catch { item.favorite = !item.favorite; status.textContent = "No se pudo guardar el favorito."; }
      });
      detailContent.append(favorite);
    }
    document.querySelector("#catalog-back").textContent = fromOrder ? "← Volver a Order Check" : "← Volver al catálogo";
    window.scrollTo(0, 0);
  }
  function backFromDetail() {
    detail.hidden = true;
    if (detailFromOrder && returnToOrder) {
      view.hidden = true; returnToOrder(); returnToOrder = null;
    } else {
      content.hidden = !products.length;
      requestAnimationFrame(() => window.scrollTo(0, listScroll));
    }
    detailFromOrder = false;
  }
  window.OrderCatalog = {
    open(code = null, returnCallback = null) {
      returnToOrder = returnCallback;
      view.hidden = false;
      if (code) showDetail(code, true);
      else { detail.hidden = true; content.hidden = !products.length; window.scrollTo(0, listScroll); }
    },
  };
  document.querySelector("#catalog-order-button").addEventListener("click", () => {
    if (!detail.hidden) backFromDetail();
    listScroll = window.scrollY;
    returnToOrder = null;
    window.OrderCheckNavigation.openOrderCheck();
  });
  document.querySelector("#catalog-back").addEventListener("click", backFromDetail);
  list.addEventListener("click", (event) => {
    const code = event.target.closest("[data-code]")?.dataset.code;
    if (code) showDetail(code);
  });
  for (const control of [search, category, photos, favorites]) control.addEventListener(control === search ? "input" : "change", renderList);
  more.addEventListener("click", appendRows);
  document.querySelector("#catalog-file").addEventListener("change", async (event) => {
    const file = event.target.files?.[0]; if (!file) return;
    status.textContent = "Validando catálogo…";
    try {
      const next = core.parseImport(await file.text(), file.name);
      const old = new Map(products.map((p) => [p.codigo, Boolean(p.favorite)]));
      next.forEach((item) => { item.favorite = old.get(item.codigo) || false; });
      await writeProducts(next);
      products = next; rebuildIndex();
      status.textContent = `${next.length} productos importados en este dispositivo. Los precios históricos requieren verificación.`;
    } catch (error) { status.textContent = `Importación cancelada: ${error.message}. El catálogo anterior sigue intacto.`; }
    event.target.value = "";
  });
  exportButton.addEventListener("click", () => {
    const file = new Blob([JSON.stringify({ data: products }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = el("a"); link.href = url; link.download = "order-check-catalog-backup.json";
    link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
  document.querySelector("#setup-view").hidden = true;
  document.querySelector("#visit-view").hidden = true;
  view.hidden = false;
  readProducts().then((items) => { products = items; rebuildIndex(); }).catch(() => { status.textContent = "No se pudo abrir el almacenamiento local. Revisa el espacio disponible o la navegación privada."; });
})();
