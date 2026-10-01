(function initOrderCheckCore(globalScope) {
  "use strict";

  const CODE_PATTERN = /(?:^|[^\d])(\d{4})(?!\d)/g;
  const EXACT_CODE_PATTERN = /^\d{4}$/;

  function parseCodes(input) {
    const text = String(input ?? "");
    const codes = [];
    const seen = new Set();
    let match;

    CODE_PATTERN.lastIndex = 0;
    while ((match = CODE_PATTERN.exec(text)) !== null) {
      const code = match[1];
      if (!seen.has(code)) {
        seen.add(code);
        codes.push(code);
      }
    }

    return codes;
  }

  function normalizeField(value) {
    const normalized = value == null ? "" : String(value).trim();
    return normalized || "-";
  }

  function parseProducts(input) {
    const products = [];
    const seen = new Set();

    function addProduct(code, inv = "-", cgoQty = "-") {
      if (seen.has(code)) {
        return;
      }
      seen.add(code);
      products.push({
        code,
        inv: normalizeField(inv),
        cgoQty: normalizeField(cgoQty),
        reviewed: false,
      });
    }

    for (const rawLine of String(input ?? "").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      if (line.includes("|")) {
        const [rawCode, rawInv, rawCgoQty] = line.split("|");
        const code = rawCode.trim();
        if (EXACT_CODE_PATTERN.test(code)) {
          addProduct(code, rawInv, rawCgoQty);
        }
        continue;
      }

      // Preserve the flexible V1 import for lines containing codes separated
      // by commas, spaces, or surrounding text.
      for (const code of parseCodes(line)) {
        addProduct(code);
      }
    }

    return products;
  }

  function sanitizeCodeInput(input) {
    return String(input ?? "")
      .replace(/\D/g, "")
      .slice(0, 4);
  }

  function normalizeProduct(item, legacyReviewed = new Set()) {
    if (!item || typeof item !== "object" || typeof item.code !== "string") {
      return null;
    }

    const code = item.code.trim();
    if (!EXACT_CODE_PATTERN.test(code)) {
      return null;
    }

    const normalized = {
      code,
      inv: normalizeField(item.inv),
      cgoQty: normalizeField(item.cgoQty),
      reviewed: item.reviewed === true || legacyReviewed.has(code),
    };
    const reviewedAt = Number(item.reviewedAt);
    if (normalized.reviewed && Number.isFinite(reviewedAt) && reviewedAt > 0) {
      normalized.reviewedAt = reviewedAt;
    }
    return normalized;
  }

  function normalizeStoredVisit(value) {
    if (!value || typeof value !== "object") {
      return null;
    }

    let sourceProducts;
    let legacyReviewed = new Set();

    if (Array.isArray(value)) {
      sourceProducts = value;
    } else if (Array.isArray(value.products)) {
      sourceProducts = value.products;
    } else if (Array.isArray(value.codes)) {
      legacyReviewed = new Set(
        (Array.isArray(value.reviewed) ? value.reviewed : []).filter(
          (code) => typeof code === "string" && EXACT_CODE_PATTERN.test(code),
        ),
      );
      sourceProducts = value.codes.map((code) =>
        typeof code === "string" ? { code, inv: "-", cgoQty: "-" } : null,
      );
    } else {
      return null;
    }

    const products = [];
    const seen = new Set();
    for (const item of sourceProducts) {
      const candidate =
        typeof item === "string"
          ? normalizeProduct({ code: item, inv: "-", cgoQty: "-" }, legacyReviewed)
          : normalizeProduct(item, legacyReviewed);
      if (candidate && !seen.has(candidate.code)) {
        seen.add(candidate.code);
        products.push(candidate);
      }
    }

    return products.length > 0 ? { products } : null;
  }

  const api = Object.freeze({
    parseCodes,
    parseProducts,
    sanitizeCodeInput,
    normalizeStoredVisit,
  });

  globalScope.OrderCheckCore = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
