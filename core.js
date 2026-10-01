(function initOrderCheckCore(globalScope) {
  "use strict";

  const CODE_PATTERN = /(?:^|[^\d])(\d{4})(?!\d)/g;
  const EXACT_CODE_PATTERN = /^\d{4}$/;
  const VALID_DAYS = new Set(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);

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

  function normalizeDay(value) {
    const raw = value == null ? "" : String(value).trim().toUpperCase();
    if (!raw || raw === "-") return "-";
    return VALID_DAYS.has(raw) ? raw : null;
  }

  function productKey(code, day = "-") {
    const normalizedCode = String(code ?? "").trim();
    const normalizedDay = normalizeDay(day);
    if (!EXACT_CODE_PATTERN.test(normalizedCode) || normalizedDay === null) return null;
    return `${normalizedCode}|${normalizedDay}`;
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
    const byKey = new Map();

    function addProduct(code, inv = "-", cgoQty = "-", rawDay = "-") {
      const day = normalizeDay(rawDay);
      if (day === null) return;

      const key = productKey(code, day);
      if (!key) return;

      const incoming = {
        code,
        inv: normalizeField(inv),
        cgoQty: normalizeField(cgoQty),
        reviewed: false,
      };
      if (day !== "-") incoming.day = day;

      const existing = byKey.get(key);
      if (existing) {
        // Same CODE + DAY is one logical row. Same CODE on another DAY stays separate.
        mergeProduct(existing, incoming);
        return;
      }

      byKey.set(key, incoming);
      products.push(incoming);
    }

    for (const rawLine of String(input ?? "").split(/\r\n?|\n|\u2028|\u2029/)) {
      const line = rawLine.trim();
      if (!line) continue;

      const tableFields = parseTableFields(line);
      if (tableFields) {
        const [rawCode = "", rawInv = "-", rawCgoQty = "-", rawDay = "-"] = tableFields;
        const code = rawCode.trim();
        if (EXACT_CODE_PATTERN.test(code)) addProduct(code, rawInv, rawCgoQty, rawDay);
        continue;
      }

      // Preserve legacy input without DAY.
      for (const code of parseCodes(line)) addProduct(code);
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

    const day = normalizeDay(item.day);
    if (day === null) return null;

    const normalized = {
      code,
      inv: normalizeField(item.inv),
      cgoQty: normalizeField(item.cgoQty),
      reviewed: item.reviewed === true || legacyReviewed.has(code),
    };
    if (day !== "-") normalized.day = day;

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
    const byKey = new Map();
    for (const item of sourceProducts) {
      const candidate =
        typeof item === "string"
          ? normalizeProduct({ code: item, inv: "-", cgoQty: "-" }, legacyReviewed)
          : normalizeProduct(item, legacyReviewed);

      if (!candidate) continue;

      const key = productKey(candidate.code, candidate.day);
      if (!key) continue;

      const existing = byKey.get(key);
      if (existing) {
        mergeProduct(existing, candidate);
        continue;
      }

      byKey.set(key, candidate);
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

  function createSelectionSequence(products) {
    const keys = [];
    const seen = new Set();

    for (const item of Array.isArray(products) ? products : []) {
      const key =
        typeof item === "string" ? productKey(item) : productKey(item?.code, item?.day);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }

    return { keys, nextIndex: 0 };
  }

  function takeNextSelectionKey(sequence) {
    if (
      !sequence ||
      !Array.isArray(sequence.keys) ||
      !Number.isInteger(sequence.nextIndex) ||
      sequence.nextIndex < 0 ||
      sequence.nextIndex >= sequence.keys.length
    ) {
      return null;
    }

    const key = sequence.keys[sequence.nextIndex];
    sequence.nextIndex += 1;
    return key;
  }

  function selectionSequenceComplete(sequence) {
    return (
      !sequence ||
      !Array.isArray(sequence.keys) ||
      sequence.nextIndex >= sequence.keys.length
    );
  }

  function selectProducts(products, options = {}) {
    const filter = options.filter ?? "all";
    const searchQuery = sanitizeCodeInput(options.searchQuery ?? "");
    const sortMode = options.sortMode ?? "original";
    let selected = Array.isArray(products) ? [...products] : [];

    // Searching is a CGO lookup, so checklist status filters must never hide a
    // matching product. With an empty search, the selected checklist tab applies.
    if (searchQuery) {
      selected = selected.filter((product) => product?.code?.startsWith(searchQuery));
    } else if (filter === "pending") {
      selected = selected.filter((product) => !product?.reviewed);
    } else if (filter === "reviewed") {
      selected = selected.filter((product) => product?.reviewed);
    }

    // Reviewed always means most recently selected first. The optional code
    // ordering applies only to Todos/Pendientes and search results.
    if (!searchQuery && filter === "reviewed") {
      return selected.sort((a, b) => (b.reviewedAt ?? 0) - (a.reviewedAt ?? 0));
    }

    if (sortMode === "ascending") {
      return selected.sort(
        (a, b) => Number(a.code) - Number(b.code) || a.code.localeCompare(b.code),
      );
    }

    if (sortMode === "descending") {
      return selected.sort(
        (a, b) => Number(b.code) - Number(a.code) || b.code.localeCompare(a.code),
      );
    }

    return selected;
  }

  const api = Object.freeze({
    parseCodes,
    parseProducts,
    sanitizeCodeInput,
    normalizeStoredVisit,
    normalizeDay,
    productKey,
    nextReviewedAt,
    createSelectionSequence,
    takeNextSelectionKey,
    selectionSequenceComplete,
    selectProducts,
  });

  globalScope.OrderCheckCore = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
