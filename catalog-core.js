(function (root) {
  "use strict";
  const HEADERS = ["codigo", "descripcion_pdf", "seccion_pdf", "medida_pdf", "unidades_por_caja_pdf", "unit_price_pdf_usd_por_peso_o_volumen", "sugg_retail_pdf_usd_por_producto"];
  const fields = ["codigo", "descripcion_pdf", "seccion_pdf", "medida_pdf", "fuente_medida", "unidades_por_caja_pdf", "unit_price_pdf_usd_por_peso_o_volumen", "sugg_retail_pdf_usd_por_producto", "fecha_inicio_lista", "fecha_fin_lista", "paginas_pdf", "revisar", "nombre_oficial_goya", "descripcion_oficial_goya", "url_ficha_goya", "url_imagen_goya", "estado_match_goya"];

  function parseCsv(text) {
    const rows = [];
    let row = [], cell = "", quoted = false;
    const input = String(text).replace(/^\uFEFF/, "");
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      if (quoted) {
        if (char === '"' && input[i + 1] === '"') { cell += '"'; i++; }
        else if (char === '"') quoted = false;
        else cell += char;
      } else if (char === '"') quoted = true;
      else if (char === ",") { row.push(cell); cell = ""; }
      else if (char === "\n" || char === "\r") {
        if (char === "\r" && input[i + 1] === "\n") i++;
        row.push(cell); if (row.some((value) => value !== "")) rows.push(row);
        row = []; cell = "";
      } else cell += char;
    }
    if (quoted) throw new Error("CSV incompleto: faltan comillas de cierre.");
    row.push(cell);
    if (row.some((value) => value !== "")) rows.push(row);
    return rows;
  }

  function parseImport(text, name = "") {
    const input = String(text);
    let records;
    if (/\.json$/i.test(name) || input.trimStart().startsWith("{") || input.trimStart().startsWith("[")) {
      const parsed = JSON.parse(input);
      records = Array.isArray(parsed) ? parsed : parsed.data;
    } else {
      const [header, ...rows] = parseCsv(input);
      if (!header) throw new Error("CSV vacío.");
      const keys = header.map((key) => key.trim().replace(/^\uFEFF/, ""));
      if (new Set(keys).size !== keys.length || !HEADERS.every((key) => keys.includes(key))) throw new Error("Faltan columnas requeridas del catálogo.");
      records = rows.map((row) => {
        if (row.length !== keys.length) throw new Error("Una fila CSV no coincide con los encabezados.");
        return Object.fromEntries(keys.map((key, index) => [key, row[index]]));
      });
    }
    if (!Array.isArray(records) || records.length === 0) throw new Error("El archivo no contiene productos.");
    const products = [], seen = new Set();
    for (const raw of records) {
      if (!raw || typeof raw !== "object") throw new Error("Producto inválido.");
      const item = Object.fromEntries(fields.map((field) => [field, String(raw[field] ?? "").trim()]));
      if (!/^\d{4}$/.test(item.codigo)) throw new Error("Todos los códigos deben tener cuatro dígitos.");
      if (seen.has(item.codigo)) throw new Error(`Código duplicado: ${item.codigo}. Revisa la presentación antes de importar.`);
      seen.add(item.codigo);
      // Only explicitly validated exact matches may display a remote image.
      if (item.estado_match_goya !== "verificado" || !validGoyaUrl(item.url_imagen_goya)) item.url_imagen_goya = "";
      if (!validGoyaUrl(item.url_ficha_goya)) item.url_ficha_goya = "";
      products.push(item);
    }
    return products;
  }
  function validGoyaUrl(value) {
    try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "www.goya.com"; }
    catch { return false; }
  }
  function fold(text) { return String(text ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function filterProducts(items, { query = "", category = "", photos = false, favorites = false } = {}) {
    const term = fold(query.trim());
    return items.filter((p) => (!category || p.seccion_pdf === category) && (!photos || p.url_imagen_goya) && (!favorites || p.favorite) && (!term || fold(`${p.codigo} ${p.descripcion_pdf} ${p.nombre_oficial_goya} ${p.descripcion_oficial_goya} ${p.seccion_pdf}`).includes(term)));
  }
  const api = { parseCsv, parseImport, filterProducts, validGoyaUrl };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.OrderCatalogCore = api;
})(typeof window === "undefined" ? globalThis : window);
