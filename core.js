(function initOrderCheckCore(globalScope) {
  "use strict";

  const CODE_PATTERN = /(?:^|[^\d])(\d{4})(?!\d)/g;

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

  function sanitizeCodeInput(input) {
    return String(input ?? "")
      .replace(/\D/g, "")
      .slice(0, 4);
  }

  function normalizeStoredVisit(value) {
    if (!value || typeof value !== "object" || !Array.isArray(value.codes)) {
      return null;
    }

    const codes = [];
    const seen = new Set();
    for (const item of value.codes) {
      if (typeof item === "string" && /^\d{4}$/.test(item) && !seen.has(item)) {
        seen.add(item);
        codes.push(item);
      }
    }

    if (codes.length === 0) {
      return null;
    }

    const reviewedValues = Array.isArray(value.reviewed) ? value.reviewed : [];
    const reviewed = reviewedValues.filter(
      (code, index) => typeof code === "string" && seen.has(code) && reviewedValues.indexOf(code) === index,
    );

    return { codes, reviewed };
  }

  const api = Object.freeze({
    parseCodes,
    sanitizeCodeInput,
    normalizeStoredVisit,
  });

  globalScope.OrderCheckCore = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
