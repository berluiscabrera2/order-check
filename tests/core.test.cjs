"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
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
  normalizeWarehouseQuantity,
  normalizeWarehouseItems,
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

test("normaliza cantidades de Warehouse como strings positivas", () => {
  assert.equal(normalizeWarehouseQuantity("003"), "3");
  assert.equal(normalizeWarehouseQuantity("12 units"), "12");
  assert.equal(normalizeWarehouseQuantity("0"), "");
  assert.equal(normalizeWarehouseQuantity(""), "");
});

test("normaliza listas de Warehouse sin perder códigos con cero inicial", () => {
  assert.deepEqual(
    normalizeWarehouseItems([
      { code: "0500", quantity: "2", addedAt: 50 },
      { code: "2423", quantity: 3 },
      { code: "0500", quantity: "9" },
      { code: "12345", quantity: "1" },
      { code: "0743", quantity: "0" },
    ]),
    [
      { code: "0500", quantity: "2", addedAt: 50 },
      { code: "2423", quantity: "3", addedAt: 0 },
    ],
  );
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
  assert.equal(takeNextSelectionKey(sequence), "2419|-");
  assert.equal(takeNextSelectionKey(sequence), "2423|-");
  assert.equal(takeNextSelectionKey(sequence), "2465|-");
  assert.equal(selectionSequenceComplete(sequence), true);
  assert.equal(takeNextSelectionKey(sequence), null);
});

test("la secuencia de Enter elimina duplicados exactos sin saltarse códigos válidos", () => {
  const sequence = createSelectionSequence([
    { code: "0500" },
    { code: "0500" },
    { code: "0743" },
    { code: "12345" },
  ]);

  assert.deepEqual(sequence.keys, ["0500|-", "0743|-"]);
  assert.equal(takeNextSelectionKey(sequence), "0500|-");
  assert.equal(takeNextSelectionKey(sequence), "0743|-");
  assert.equal(takeNextSelectionKey(sequence), null);
});


test("DAY se normaliza y valida", () => {
  assert.equal(normalizeDay("wed"), "WED");
  assert.equal(normalizeDay(" THU "), "THU");
  assert.equal(normalizeDay(""), "-");
  assert.equal(normalizeDay("XYZ"), null);
});

test("el mismo código en días distintos se conserva como dos productos", () => {
  assert.deepEqual(parseProducts("1479|20|1|WED\n1479|18|2|THU"), [
    { code: "1479", inv: "20", cgoQty: "1", reviewed: false, day: "WED" },
    { code: "1479", inv: "18", cgoQty: "2", reviewed: false, day: "THU" },
  ]);
});

test("el mismo código repetido el mismo día se fusiona", () => {
  assert.deepEqual(parseProducts("1479|-|-|WED\n1479|20|1|WED"), [
    { code: "1479", inv: "20", cgoQty: "1", reviewed: false, day: "WED" },
  ]);
});

test("DAY inválido rechaza la fila", () => {
  assert.deepEqual(parseProducts("1479|20|1|XYZ\n2423|36|1|THU"), [
    { code: "2423", inv: "36", cgoQty: "1", reviewed: false, day: "THU" },
  ]);
});

test("productKey diferencia el mismo código por día", () => {
  assert.equal(productKey("1479", "WED"), "1479|WED");
  assert.equal(productKey("1479", "THU"), "1479|THU");
});

test("la migración conserva el mismo código en días distintos", () => {
  assert.deepEqual(
    normalizeStoredVisit({
      products: [
        { code: "1479", inv: "20", cgoQty: "1", day: "WED", reviewed: true, reviewedAt: 10 },
        { code: "1479", inv: "18", cgoQty: "2", day: "THU", reviewed: false },
      ],
    }),
    {
      products: [
        { code: "1479", inv: "20", cgoQty: "1", reviewed: true, day: "WED", reviewedAt: 10 },
        { code: "1479", inv: "18", cgoQty: "2", reviewed: false, day: "THU" },
      ],
    },
  );
});

test("Enter trata CODE + DAY como identidades independientes", () => {
  const sequence = createSelectionSequence([
    { code: "1479", day: "WED" },
    { code: "1479", day: "THU" },
    { code: "2423", day: "THU" },
  ]);
  assert.deepEqual(sequence.keys, ["1479|WED", "1479|THU", "2423|THU"]);
  assert.equal(takeNextSelectionKey(sequence), "1479|WED");
  assert.equal(takeNextSelectionKey(sequence), "1479|THU");
  assert.equal(takeNextSelectionKey(sequence), "2423|THU");
  assert.equal(takeNextSelectionKey(sequence), null);
});

test("Todos conserva el orden original por defecto", () => {
  const products = [
    { code: "3984", reviewed: false },
    { code: "0500", reviewed: true, reviewedAt: 20 },
    { code: "2423", reviewed: false },
  ];

  assert.deepEqual(
    selectProducts(products, { filter: "all", sortMode: "original" }).map((item) => item.code),
    ["3984", "0500", "2423"],
  );
});

test("Pendientes conserva el orden original y admite orden ascendente o descendente", () => {
  const products = [
    { code: "3984", reviewed: false },
    { code: "0500", reviewed: true, reviewedAt: 20 },
    { code: "2423", reviewed: false },
  ];

  assert.deepEqual(
    selectProducts(products, { filter: "pending", sortMode: "original" }).map((item) => item.code),
    ["3984", "2423"],
  );
  assert.deepEqual(
    selectProducts(products, { filter: "pending", sortMode: "ascending" }).map((item) => item.code),
    ["2423", "3984"],
  );
  assert.deepEqual(
    selectProducts(products, { filter: "pending", sortMode: "descending" }).map((item) => item.code),
    ["3984", "2423"],
  );
});

test("Revisados siempre muestra la selección más reciente arriba", () => {
  const products = [
    { code: "3984", reviewed: true, reviewedAt: 10 },
    { code: "0500", reviewed: true, reviewedAt: 30 },
    { code: "2423", reviewed: true, reviewedAt: 20 },
  ];

  assert.deepEqual(
    selectProducts(products, { filter: "reviewed", sortMode: "ascending" }).map(
      (item) => item.code,
    ),
    ["0500", "2423", "3984"],
  );
});

test("la búsqueda encuentra productos sin importar el filtro de checklist", () => {
  const products = [
    { code: "2423", reviewed: true, reviewedAt: 10 },
    { code: "2469", reviewed: false },
  ];

  assert.deepEqual(
    selectProducts(products, {
      filter: "pending",
      searchQuery: "2423",
      sortMode: "original",
    }).map((item) => item.code),
    ["2423"],
  );
  assert.deepEqual(
    selectProducts(products, {
      filter: "reviewed",
      searchQuery: "2469",
      sortMode: "original",
    }).map((item) => item.code),
    ["2469"],
  );
});
