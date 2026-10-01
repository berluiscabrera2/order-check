"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseCodes,
  parseProducts,
  sanitizeCodeInput,
  normalizeStoredVisit,
  nextReviewedAt,
  createSelectionSequence,
  takeNextSelectionCode,
  selectionSequenceComplete,
} = require("../core.js");

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


test("acepta filas Markdown y conserva correctamente CODE, INV y CGO QTY", () => {
  assert.deepEqual(
    parseProducts("| 0500 | 8 | 1 |\n| 0743 | - | 2 |\n| --- | --- | --- |"),
    [
      { code: "0500", inv: "8", cgoQty: "1", reviewed: false },
      { code: "0743", inv: "-", cgoQty: "2", reviewed: false },
    ],
  );
});

test("acepta columnas separadas por tab sin desplazar los campos", () => {
  assert.deepEqual(parseProducts("1479\t20\t1\n3322\t-\t2"), [
    { code: "1479", inv: "20", cgoQty: "1", reviewed: false },
    { code: "3322", inv: "-", cgoQty: "2", reviewed: false },
  ]);
});

test("acepta CR, CRLF y separadores Unicode como saltos de línea", () => {
  assert.deepEqual(parseProducts("1479|20|1\r2423|36|1\r\n0500|8|1\u20280743|-|2"), [
    { code: "1479", inv: "20", cgoQty: "1", reviewed: false },
    { code: "2423", inv: "36", cgoQty: "1", reviewed: false },
    { code: "0500", inv: "8", cgoQty: "1", reviewed: false },
    { code: "0743", inv: "-", cgoQty: "2", reviewed: false },
  ]);
});

test("un duplicado completo rellena metadatos faltantes sin cambiar el orden", () => {
  assert.deepEqual(parseProducts("0500\n2423|36|1\n0500|8|2"), [
    { code: "0500", inv: "8", cgoQty: "2", reviewed: false },
    { code: "2423", inv: "36", cgoQty: "1", reviewed: false },
  ]);
});

test("un duplicado incompleto nunca borra metadatos ya válidos", () => {
  assert.deepEqual(parseProducts("0500|8|2\n0500\n0500|-|-"), [
    { code: "0500", inv: "8", cgoQty: "2", reviewed: false },
  ]);
});

test("no convierte cuatro dígitos que forman parte de un número más largo", () => {
  assert.deepEqual(parseCodes("UPC 1234567890500; código 0500"), ["0500"]);
  assert.deepEqual(parseProducts("UPC 1234567890500"), []);
});

test("la migración de duplicados conserva metadata y el estado revisado más reciente", () => {
  assert.deepEqual(
    normalizeStoredVisit({
      products: [
        { code: "0500", inv: "-", cgoQty: "-", reviewed: false },
        { code: "0500", inv: "8", cgoQty: "2", reviewed: true, reviewedAt: 100 },
        { code: "0500", inv: "99", cgoQty: "9", reviewed: true, reviewedAt: 150 },
      ],
    }),
    {
      products: [{ code: "0500", inv: "8", cgoQty: "2", reviewed: true, reviewedAt: 150 }],
    },
  );
});

test("reviewedAt siempre aumenta aunque dos selecciones ocurran en el mismo milisegundo", () => {
  const products = [
    { code: "0500", reviewedAt: 1000 },
    { code: "0743", reviewedAt: 1000 },
  ];
  assert.equal(nextReviewedAt(products, 1000), 1001);
  assert.equal(nextReviewedAt(products, 999), 1001);
  assert.equal(nextReviewedAt(products, 2000), 2000);
});


test("la secuencia de Enter conserva exactamente el orden visible de arriba hacia abajo", () => {
  const sequence = createSelectionSequence([
    { code: "2419" },
    { code: "2423" },
    { code: "2465" },
  ]);

  assert.equal(selectionSequenceComplete(sequence), false);
  assert.equal(takeNextSelectionCode(sequence), "2419");
  assert.equal(takeNextSelectionCode(sequence), "2423");
  assert.equal(takeNextSelectionCode(sequence), "2465");
  assert.equal(selectionSequenceComplete(sequence), true);
  assert.equal(takeNextSelectionCode(sequence), null);
});

test("la secuencia de Enter elimina duplicados sin saltarse códigos válidos", () => {
  const sequence = createSelectionSequence([
    { code: "0500" },
    { code: "0500" },
    { code: "0743" },
    { code: "12345" },
  ]);

  assert.deepEqual(sequence.codes, ["0500", "0743"]);
  assert.equal(takeNextSelectionCode(sequence), "0500");
  assert.equal(takeNextSelectionCode(sequence), "0743");
  assert.equal(takeNextSelectionCode(sequence), null);
});
