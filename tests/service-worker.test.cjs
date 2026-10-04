"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "service-worker.js"), "utf8");

function createWorker(cachedResponses, cacheKeys = [], fetchHandler = null) {
  const listeners = {};
  const cacheWrites = [];
  const deletedCaches = [];
  const fetchCalls = [];
  const context = {
    URL,
    Response,
    fetch: async (...args) => {
      fetchCalls.push(args);
      if (fetchHandler) return fetchHandler(...args);
      throw new Error("offline");
    },
    caches: {
      open: async () => ({
        addAll: async () => undefined,
        put: async (request) => cacheWrites.push(typeof request === "string" ? request : request.url),
      }),
      keys: async () => cacheKeys,
      delete: async (key) => {
        deletedCaches.push(key);
        return true;
      },
      match: async (request) => {
        const key = typeof request === "string" ? request : request.url;
        return cachedResponses.get(key) ?? null;
      },
    },
    self: {
      location: { origin: "https://berluiscabrera2.github.io" },
      clients: { claim: async () => undefined },
      skipWaiting: () => undefined,
      addEventListener: (type, callback) => {
        listeners[type] = callback;
      },
    },
  };

  vm.runInNewContext(source, context);
  return { listeners, cacheWrites, deletedCaches, fetchCalls };
}

test("la instalación fuerza archivos frescos antes de guardarlos offline", async () => {
  const { listeners, cacheWrites, fetchCalls } = createWorker(
    new Map(),
    [],
    async () => new Response("fresh app"),
  );
  let installPromise;

  listeners.install({
    waitUntil: (promise) => {
      installPromise = promise;
    },
  });
  await installPromise;

  assert.equal(fetchCalls.length, 9);
  assert.ok(fetchCalls.every(([, options]) => options?.cache === "reload"));
  assert.equal(cacheWrites.length, 9);
  assert.ok(cacheWrites.includes("/order-check/app.js"));
  assert.ok(cacheWrites.includes("/order-check/index.html"));
});

test("sirve un recurso del shell desde caché cuando no hay red", async () => {
  const resourceUrl = "https://berluiscabrera2.github.io/order-check/app.js";
  const { listeners } = createWorker(new Map([[resourceUrl, new Response("cached app")]]));
  let responsePromise;

  listeners.fetch({
    request: { method: "GET", mode: "cors", url: resourceUrl },
    respondWith: (promise) => {
      responsePromise = promise;
    },
  });

  const response = await responsePromise;
  assert.equal(await response.text(), "cached app");
});

test("una navegación offline vuelve al index de /order-check/", async () => {
  const { listeners } = createWorker(new Map([["/order-check/index.html", new Response("offline app")]]));
  let responsePromise;

  listeners.fetch({
    request: {
      method: "GET",
      mode: "navigate",
      url: "https://berluiscabrera2.github.io/order-check/otra-ruta",
    },
    respondWith: (promise) => {
      responsePromise = promise;
    },
  });

  const response = await responsePromise;
  assert.equal(await response.text(), "offline app");
});

test("al activar elimina solo cachés antiguas de Order Check", async () => {
  const { listeners, deletedCaches } = createWorker(new Map(), [
    "order-check-shell-v1.8.1",
    "order-check-shell-v1.9.0",
    "order-check-shell-v1.9.1",
    "order-check-shell-v1.10.0",
    "order-check-shell-v1.10.1",
    "order-check-shell-v1.10.2",
    "order-check-shell-v1.10.3",
    "another-project-shell-v4",
  ]);
  let activationPromise;

  listeners.activate({
    waitUntil: (promise) => {
      activationPromise = promise;
    },
  });
  await activationPromise;

  assert.deepEqual(deletedCaches, [
    "order-check-shell-v1.8.1",
    "order-check-shell-v1.9.0",
    "order-check-shell-v1.9.1",
    "order-check-shell-v1.10.0",
    "order-check-shell-v1.10.1",
    "order-check-shell-v1.10.2",
  ]);
});
