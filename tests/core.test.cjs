"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseCodes, parseProducts, sanitizeCodeInput, normalizeStoredVisit } = require("../core.js");

test("parsea el formato completo y conserva todos los valores como strings", () => {
  assert.deepEqual(parseProducts("1479|20|1\n2423|36|1\n0500|8|1"), [
    { code: "1479", inv: "20", cgoQty: "1", reviewed: false },
    { code: "2423", inv: "36", cgoQty: "1", reviewed: false },
    { code: "0500", inv: "8", cgoQty: "1", reviewed: false },
  ]);
});

test("parsea el formato simple de V1 con metadatos faltantes normalizados", () => {
  assert.deepEqual(parseProducts("1479\n2423\n2469\n0500\n0743"), [
    { code: "1479", inv: "-", cgoQty: "-", reviewed: false },
    { code: "2423", inv: "-", cgoQty: "-", reviewed: false },
    { code: "2469", inv: "-", cgoQty: "-", reviewed: false },
    { code: "0500", inv: "-", cgoQty: "-", reviewed: false },
    { code: "0743", inv: "-", cgoQty: "-", reviewed: false },
  ]);
});

test("acepta formatos completos y simples mezclados", () => {
  assert.deepEqual(parseProducts("1479|20|1\n2423\n2469|53|1\n0500\n0743|30|1"), [
    { code: "1479", inv: "20", cgoQty: "1", reviewed: false },
    { code: "2423", inv: "-", cgoQty: "-", reviewed: false },
    { code: "2469", inv: "53", cgoQty: "1", reviewed: false },
    { code: "0500", inv: "-", cgoQty: "-", reviewed: false },
    { code: "0743", inv: "30", cgoQty: "1", reviewed: false },
  ]);
});

test("convierte campos vacíos en guiones", () => {
  assert.deepEqual(parseProducts("2469|53|\n0743||1\n2423||"), [
    { code: "2469", inv: "53", cgoQty: "-", reviewed: false },
    { code: "0743", inv: "-", cgoQty: "1", reviewed: false },
    { code: "2423", inv: "-", cgoQty: "-", reviewed: false },
  ]);
});

test("ignora filas inválidas, elimina duplicados por code y conserva el orden", () => {
  assert.deepEqual(parseProducts("3984|10|1\n12345|2|1\ntexto|3|1\n1479\n3984|99|9\n0500"), [
    { code: "3984", inv: "10", cgoQty: "1", reviewed: false },
    { code: "1479", inv: "-", cgoQty: "-", reviewed: false },
    { code: "0500", inv: "-", cgoQty: "-", reviewed: false },
  ]);
});

test("mantiene la importación flexible de V1 para líneas sin separadores de campos", () => {
  assert.deepEqual(parseProducts("SKU: 1479, 2423 0500; repetido 1479"), [
    { code: "1479", inv: "-", cgoQty: "-", reviewed: false },
    { code: "2423", inv: "-", cgoQty: "-", reviewed: false },
    { code: "0500", inv: "-", cgoQty: "-", reviewed: false },
  ]);
});

test("parseCodes conserva la compatibilidad de la API V1", () => {
  assert.deepEqual(parseCodes("1479\n2423, 2469 0500"), ["1479", "2423", "2469", "0500"]);
});

test("limpia el buscador a solo cuatro dígitos", () => {
  assert.equal(sanitizeCodeInput("05a00"), "0500");
  assert.equal(sanitizeCodeInput("07439"), "0743");
});

test("migra una visita V1 y conserva sus checks", () => {
  assert.deepEqual(
    normalizeStoredVisit({ codes: ["0500", "2423", "0500", 743], reviewed: ["0500", "9999"] }),
    {
      products: [
        { code: "0500", inv: "-", cgoQty: "-", reviewed: true },
        { code: "2423", inv: "-", cgoQty: "-", reviewed: false },
      ],
    },
  );
});

test("migra también un arreglo antiguo de códigos", () => {
  assert.deepEqual(normalizeStoredVisit(["1479", "2423", "0500"]), {
    products: [
      { code: "1479", inv: "-", cgoQty: "-", reviewed: false },
      { code: "2423", inv: "-", cgoQty: "-", reviewed: false },
      { code: "0500", inv: "-", cgoQty: "-", reviewed: false },
    ],
  });
});

test("normaliza el formato nuevo sin perder metadatos ni reviewed", () => {
  assert.deepEqual(
    normalizeStoredVisit({
      products: [
        { code: "2423", inv: 36, cgoQty: "1", reviewed: true },
        { code: "0500", inv: "", cgoQty: null, reviewed: false },
      ],
    }),
    {
      products: [
        { code: "2423", inv: "36", cgoQty: "1", reviewed: true },
        { code: "0500", inv: "-", cgoQty: "-", reviewed: false },
      ],
    },
  );
});

test("rechaza una visita inválida o vacía", () => {
  assert.equal(normalizeStoredVisit(null), null);
  assert.equal(normalizeStoredVisit({ products: [] }), null);
  assert.equal(normalizeStoredVisit({ codes: [], reviewed: [] }), null);
});
