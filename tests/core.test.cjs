"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCodes, sanitizeCodeInput, normalizeStoredVisit } = require("../core.js");

test("parsea códigos separados por saltos de línea, comas y espacios", () => {
  assert.deepEqual(parseCodes("1479\n2423, 2469 2476"), ["1479", "2423", "2469", "2476"]);
});

test("conserva ceros iniciales", () => {
  assert.deepEqual(parseCodes("0500, 0743"), ["0500", "0743"]);
});

test("ignora texto adicional, duplicados y grupos numéricos que no tienen cuatro dígitos", () => {
  const input = "SKU: 1479 / pedido 2423. Repetido 1479. Ignorar 12345 y 123. Luego 0500.";
  assert.deepEqual(parseCodes(input), ["1479", "2423", "0500"]);
});

test("conserva el orden original", () => {
  assert.deepEqual(parseCodes("3984 1479 2423 3984 0500"), ["3984", "1479", "2423", "0500"]);
});

test("limpia el buscador a solo cuatro dígitos", () => {
  assert.equal(sanitizeCodeInput("05a00"), "0500");
  assert.equal(sanitizeCodeInput("07439"), "0743");
});

test("normaliza una visita guardada sin convertir códigos a números", () => {
  assert.deepEqual(
    normalizeStoredVisit({ codes: ["0500", "2423", "0500", 743], reviewed: ["0500", "9999"] }),
    { codes: ["0500", "2423"], reviewed: ["0500"] },
  );
});

test("rechaza una visita inválida o vacía", () => {
  assert.equal(normalizeStoredVisit(null), null);
  assert.equal(normalizeStoredVisit({ codes: [], reviewed: [] }), null);
});
