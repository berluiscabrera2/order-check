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

  function mergeField(currentValue, incomingValue) {
    const current = normalizeField(currentValue);
    const incoming = normalizeField(incomingValue);
    return current === "-" && incoming !== "-" ? incoming : current;
  }

  function mergeProduct(existing, incoming) {
    existing.inv = mergeField(existing.inv, incoming.inv);
    existing.cgoQty = mergeField(existing.cgoQty, incoming.cgoQty);

    if (incoming.reviewed === true) {
      existing.reviewed = true;
    }

    const incomingReviewedAt = Number(incoming.reviewedAt);
    const existingReviewedAt = Number(existing.reviewedAt);
    if (
      incoming.reviewed === true &&
      Number.isFinite(incomingReviewedAt) &&
      incomingReviewedAt > 0 &&
      (!Number.isFinite(existingReviewedAt) || incomingReviewedAt > existingReviewedAt)
    ) {
      existing.reviewedAt = incomingReviewedAt;
    }

    return existing;
  }

  function parseTableFields(line) {
    let candidate = line.trim();

    if (candidate.includes("|")) {
      // Accept both plain pipe rows and Markdown table rows:
      // 1479|20|1
      // | 1479 | 20 | 1 |
      if (candidate.startsWith("|")) {
        candidate = candidate.slice(1);
      }
      if (candidate.endsWith("|")) {
        candidate = candidate.slice(0, -1);
      }
      return candidate.split("|").map((field) => field.trim());
    }

    if (candidate.includes("\t")) {
      return candidate.split("\t").map((field) => field.trim());
    }

    return null;
  }

  function parseProducts(input) {
    const products = [];
    const byCode = new Map();

    function addProduct(code, inv = "-", cgoQty = "-") {
      const incoming = {
        code,
        inv: normalizeField(inv),
        cgoQty: normalizeField(cgoQty),
        reviewed: false,
      };

      const existing = byCode.get(code);
      if (existing) {
        // Keep first-row ordering, but never lose metadata just because a
        // simpler duplicate appeared before the complete row.
        mergeProduct(existing, incoming);
        return;
      }

      byCode.set(code, incoming);
      products.push(incoming);
    }

    for (const rawLine of String(input ?? "").split(/\r\n?|\n|\u2028|\u2029/)) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      const tableFields = parseTableFields(line);
      if (tableFields) {
        const [rawCode = "", rawInv = "-", rawCgoQty = "-"] = tableFields;
        const code = rawCode.trim();
        if (EXACT_CODE_PATTERN.test(code)) {
          addProduct(code, rawInv, rawCgoQty);
        }
        continue;
      }

      // Preserve the flexible V1 import for lines containing codes separated
      // by commas, spaces, or surrounding text. Four digits embedded inside
      // a longer number are intentionally ignored by parseCodes().
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
    const byCode = new Map();
    for (const item of sourceProducts) {
      const candidate =
        typeof item === "string"
          ? normalizeProduct({ code: item, inv: "-", cgoQty: "-" }, legacyReviewed)
          : normalizeProduct(item, legacyReviewed);

      if (!candidate) {
        continue;
      }

      const existing = byCode.get(candidate.code);
      if (existing) {
        mergeProduct(existing, candidate);
        continue;
      }

      byCode.set(candidate.code, candidate);
      products.push(candidate);
    }

    return products.length > 0 ? { products } : null;
  }

  function nextReviewedAt(products, now = Date.now()) {
    let latest = 0;

    for (const product of Array.isArray(products) ? products : []) {
      const reviewedAt = Number(product?.reviewedAt);
      if (Number.isFinite(reviewedAt) && reviewedAt > latest) {
        latest = reviewedAt;
      }
    }

    const current = Number(now);
    const safeNow = Number.isFinite(current) && current > 0 ? current : 0;
    return Math.max(safeNow, latest + 1);
  }

  const api = Object.freeze({
    parseCodes,
    parseProducts,
    sanitizeCodeInput,
    normalizeStoredVisit,
    nextReviewedAt,
  });

  globalScope.OrderCheckCore = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
