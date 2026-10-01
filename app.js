(function initOrderCheck() {
  "use strict";

  const APP_VERSION = "1.1.0";
  const STORAGE_KEY = "order-check.visit.v1";
  const core = window.OrderCheckCore;

  const elements = {
    setupView: document.querySelector("#setup-view"),
    visitView: document.querySelector("#visit-view"),
    setupForm: document.querySelector("#setup-form"),
    codesInput: document.querySelector("#codes-input"),
    setupMessage: document.querySelector("#setup-message"),
    progressText: document.querySelector("#progress-text"),
    loadedCount: document.querySelector("#loaded-count"),
    searchInput: document.querySelector("#search-input"),
    searchResult: document.querySelector("#search-result"),
    resultTitle: document.querySelector("#result-title"),
    resultMessage: document.querySelector("#result-message"),
    resultDetails: document.querySelector("#result-details"),
    resultInv: document.querySelector("#result-inv"),
    resultCgoQty: document.querySelector("#result-cgo-qty"),
    resultReviewedNote: document.querySelector("#result-reviewed-note"),
    resultAction: document.querySelector("#result-action"),
    checklistSection: document.querySelector("#checklist-section"),
    codeList: document.querySelector("#code-list"),
    emptyFilterMessage: document.querySelector("#empty-filter-message"),
    filterButtons: [...document.querySelectorAll("[data-filter]")],
    newVisitButton: document.querySelector("#new-visit-button"),
    appVersion: document.querySelector("#app-version"),
  };

  let visit = loadVisit();
  let activeFilter = "all";

  function loadVisit() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const normalized = core.normalizeStoredVisit(saved);
      if (normalized) {
        // Writing the normalized shape migrates V1 visits while preserving checks.
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      }
      return normalized;
    } catch {
      return null;
    }
  }

  function saveVisit() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visit));
  }

  function findProduct(code) {
    return visit?.products.find((product) => product.code === code) ?? null;
  }

  function setView() {
    const hasVisit = Boolean(visit?.products.length);
    elements.setupView.hidden = hasVisit;
    elements.visitView.hidden = !hasVisit;

    if (hasVisit) {
      renderVisit();
    } else {
      elements.codesInput.value = "";
      elements.setupMessage.textContent = "";
    }
  }

  function renderVisit() {
    renderProgress();
    renderFilters();
    renderChecklist();
    renderSearchResult();
  }

  function renderProgress() {
    const reviewed = visit.products.filter((product) => product.reviewed).length;
    const total = visit.products.length;
    elements.progressText.textContent = `${reviewed} de ${total} revisados`;
    elements.loadedCount.textContent = `${total} ${total === 1 ? "código cargado" : "códigos cargados"}`;
  }

  function renderFilters() {
    for (const button of elements.filterButtons) {
      const selected = button.dataset.filter === activeFilter;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
  }

  function filteredProducts() {
    if (activeFilter === "pending") {
      return visit.products.filter((product) => !product.reviewed);
    }
    if (activeFilter === "reviewed") {
      return visit.products.filter((product) => product.reviewed);
    }
    return visit.products;
  }

  function createMetaItem(label, value) {
    const item = document.createElement("span");
    const name = document.createElement("span");
    const data = document.createElement("strong");
    name.textContent = label;
    data.textContent = value;
    item.append(name, data);
    return item;
  }

  function renderChecklist() {
    const products = filteredProducts();
    const fragment = document.createDocumentFragment();

    for (const product of products) {
      const item = document.createElement("li");
      item.className = `code-row${product.reviewed ? " is-reviewed" : ""}`;

      const label = document.createElement("label");
      label.className = "code-label";

      const checkbox = document.createElement("input");
      checkbox.className = "code-checkbox";
      checkbox.type = "checkbox";
      checkbox.checked = product.reviewed;
      checkbox.dataset.code = product.code;
      checkbox.setAttribute("aria-label", `${product.reviewed ? "Desmarcar" : "Marcar"} código ${product.code}`);

      const content = document.createElement("span");
      content.className = "code-content";

      const top = document.createElement("span");
      top.className = "code-top";

      const value = document.createElement("span");
      value.className = "code-value";
      value.textContent = product.code;

      const state = document.createElement("span");
      state.className = "code-state";
      state.textContent = product.reviewed ? "Revisado" : "Pendiente";

      const meta = document.createElement("span");
      meta.className = "code-meta";
      meta.append(createMetaItem("INV", product.inv), createMetaItem("QTY", product.cgoQty));

      top.append(value, state);
      content.append(top, meta);
      label.append(checkbox, content);
      item.append(label);
      fragment.append(item);
    }

    elements.codeList.replaceChildren(fragment);
    elements.emptyFilterMessage.hidden = products.length > 0;
  }

  function renderSearchResult() {
    const code = elements.searchInput.value;
    const complete = code.length === 4;
    elements.checklistSection.hidden = code.length > 0;
    elements.searchResult.hidden = !complete;

    if (!complete) {
      elements.searchResult.className = "search-result";
      elements.resultDetails.hidden = true;
      return;
    }

    const product = findProduct(code);
    if (!product) {
      elements.searchResult.className = "search-result is-no";
      elements.resultTitle.textContent = "✕ CGO NO";
      elements.resultMessage.textContent = "Revisar para agregar al pedido.";
      elements.resultDetails.hidden = true;
      elements.resultReviewedNote.hidden = true;
      elements.resultAction.hidden = true;
      return;
    }

    elements.searchResult.className = "search-result is-yes";
    elements.resultTitle.textContent = "✓ CGO SÍ";
    elements.resultMessage.textContent = "Ya está siendo pedido.";
    elements.resultDetails.hidden = false;
    elements.resultInv.textContent = product.inv;
    elements.resultCgoQty.textContent = product.cgoQty;
    elements.resultReviewedNote.hidden = !product.reviewed;
    elements.resultReviewedNote.textContent = "Este código ya estaba marcado como revisado.";
    elements.resultAction.hidden = false;
    elements.resultAction.classList.toggle("is-unmark", product.reviewed);
    elements.resultAction.textContent = product.reviewed ? "↶ Desmarcar" : "✓ Marcar como revisado";
    elements.resultAction.dataset.code = code;
  }

  function setReviewed(code, shouldReview) {
    const product = findProduct(code);
    if (!product) {
      return;
    }
    product.reviewed = shouldReview;
    saveVisit();
    renderProgress();
    renderChecklist();
  }

  function clearSearchAndRefocus() {
    elements.searchInput.value = "";
    renderSearchResult();
    elements.searchInput.focus({ preventScroll: true });
  }

  elements.setupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const products = core.parseProducts(elements.codesInput.value);
    if (products.length === 0) {
      elements.setupMessage.textContent = "No encontré productos con un código válido de 4 dígitos.";
      elements.codesInput.focus();
      return;
    }

    visit = { products };
    activeFilter = "all";
    saveVisit();
    elements.searchInput.value = "";
    setView();
    elements.searchInput.focus({ preventScroll: true });
  });

  elements.searchInput.addEventListener("input", () => {
    const sanitized = core.sanitizeCodeInput(elements.searchInput.value);
    if (sanitized !== elements.searchInput.value) {
      elements.searchInput.value = sanitized;
    }
    renderSearchResult();
  });

  elements.resultAction.addEventListener("click", () => {
    const code = elements.resultAction.dataset.code;
    const product = code ? findProduct(code) : null;
    if (!product) {
      return;
    }
    setReviewed(code, !product.reviewed);
    clearSearchAndRefocus();
  });

  elements.codeList.addEventListener("change", (event) => {
    const checkbox = event.target.closest("input[data-code]");
    if (!checkbox) {
      return;
    }
    setReviewed(checkbox.dataset.code, checkbox.checked);
  });

  for (const button of elements.filterButtons) {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      renderFilters();
      renderChecklist();
    });
  }

  elements.newVisitButton.addEventListener("click", () => {
    const confirmed = window.confirm(
      "¿Iniciar una nueva visita? Se borrará la lista CGO actual y todos los checks.",
    );
    if (!confirmed) {
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    visit = null;
    activeFilter = "all";
    elements.searchInput.value = "";
    setView();
    elements.codesInput.focus({ preventScroll: true });
  });

  elements.appVersion.textContent = `v${APP_VERSION}`;
  setView();

  if ("serviceWorker" in navigator) {
    let reloadingForUpdate = false;
    const hadController = Boolean(navigator.serviceWorker.controller);

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hadController && !reloadingForUpdate) {
        reloadingForUpdate = true;
        window.location.reload();
      }
    });

    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register("/order-check/service-worker.js", {
          scope: "/order-check/",
          updateViaCache: "none",
        });
        if (navigator.onLine) {
          await registration.update();
        }
      } catch (error) {
        console.error("No se pudo registrar el service worker.", error);
      }
    });
  }
})();
