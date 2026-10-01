(function initOrderCheck() {
  "use strict";

  const APP_VERSION = "1.3.0";
  const STORAGE_KEY = "order-check.visit.v1";
  const DISPLAY_STORAGE_KEY = "order-check.display.v1";
  const core = window.OrderCheckCore;

  const elements = {
    setupView: document.querySelector("#setup-view"),
    visitView: document.querySelector("#visit-view"),
    setupForm: document.querySelector("#setup-form"),
    codesInput: document.querySelector("#codes-input"),
    setupMessage: document.querySelector("#setup-message"),
    progressText: document.querySelector("#progress-text"),
    loadedCount: document.querySelector("#loaded-count"),
    visitHeader: document.querySelector("#visit-header"),
    appTabs: document.querySelector("#app-tabs"),
    tabButtons: [...document.querySelectorAll("[data-app-tab]")],
    searchCard: document.querySelector("#search-card"),
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
    displaySection: document.querySelector("#display-section"),
    displayForm: document.querySelector("#display-form"),
    displayCodeInput: document.querySelector("#display-code-input"),
    displayQuantityInput: document.querySelector("#display-quantity-input"),
    displayMessage: document.querySelector("#display-message"),
    displayCount: document.querySelector("#display-count"),
    displayList: document.querySelector("#display-list"),
    displayEmptyMessage: document.querySelector("#display-empty-message"),
    productDetailView: document.querySelector("#product-detail-view"),
    detailBackButton: document.querySelector("#detail-back-button"),
    detailCode: document.querySelector("#detail-code"),
    detailState: document.querySelector("#detail-state"),
    detailInv: document.querySelector("#detail-inv"),
    detailCgoQty: document.querySelector("#detail-cgo-qty"),
    detailAction: document.querySelector("#detail-action"),
    filterButtons: [...document.querySelectorAll("[data-filter]")],
    newVisitButton: document.querySelector("#new-visit-button"),
    appVersion: document.querySelector("#app-version"),
  };

  let visit = loadVisit();
  let displayItems = visit ? loadDisplayItems() : [];
  let activeFilter = "all";
  let activeTab = "cgo";
  let selectedProductCode = productCodeFromHash();

  if (!visit) {
    localStorage.removeItem(DISPLAY_STORAGE_KEY);
  }
  let lastOpenedProductCode = null;

  function productCodeFromHash() {
    const match = window.location.hash.match(/^#product-(\d{4})$/);
    return match ? match[1] : null;
  }

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

  function normalizeDisplayQuantity(value) {
    const digits = String(value ?? "").replace(/\D/g, "").slice(0, 4);
    if (!digits) return "";
    const quantity = Number(digits);
    return quantity > 0 ? String(quantity) : "";
  }

  function loadDisplayItems() {
    try {
      const saved = JSON.parse(localStorage.getItem(DISPLAY_STORAGE_KEY));
      if (!Array.isArray(saved)) return [];
      const items = [];
      const seen = new Set();
      for (const item of saved) {
        const code = core.sanitizeCodeInput(item?.code);
        const quantity = normalizeDisplayQuantity(item?.quantity);
        if (code.length !== 4 || !quantity || seen.has(code)) continue;
        const addedAt = Number(item?.addedAt);
        seen.add(code);
        items.push({ code, quantity, addedAt: Number.isFinite(addedAt) && addedAt > 0 ? addedAt : 0 });
      }
      return items;
    } catch {
      return [];
    }
  }

  function saveVisit() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visit));
  }

  function saveDisplayItems() {
    localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(displayItems));
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
    renderTabs();
    renderFilters();
    renderChecklist();
    renderDisplayList();
    renderSearchResult();

    if (selectedProductCode && findProduct(selectedProductCode)) {
      showProductDetail(selectedProductCode, false);
    } else {
      selectedProductCode = null;
      showVisitHome();
    }
  }

  function renderProgress() {
    const reviewed = visit.products.filter((product) => product.reviewed).length;
    const total = visit.products.length;
    elements.progressText.textContent = `${reviewed} de ${total} revisados`;
    elements.loadedCount.textContent = `${total} ${total === 1 ? "código cargado" : "códigos cargados"}`;
  }

  function renderTabs() {
    for (const button of elements.tabButtons) {
      const selected = button.dataset.appTab === activeTab;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.setAttribute("tabindex", selected ? "0" : "-1");
    }
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
      return visit.products
        .filter((product) => product.reviewed)
        .slice()
        .sort((a, b) => (b.reviewedAt ?? 0) - (a.reviewedAt ?? 0));
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

  function renderDisplayList() {
    const items = [...displayItems].sort((a, b) => b.addedAt - a.addedAt);
    const fragment = document.createDocumentFragment();

    for (const item of items) {
      const row = document.createElement("li");
      row.className = "display-row";

      const codeBlock = document.createElement("div");
      codeBlock.className = "display-code-block";
      const label = document.createElement("span");
      label.className = "display-code-label";
      label.textContent = "Código";
      const code = document.createElement("strong");
      code.className = "display-code";
      code.textContent = item.code;

      const quantityField = document.createElement("label");
      quantityField.className = "display-quantity-field";
      const quantityLabel = document.createElement("span");
      quantityLabel.textContent = "Cantidad display";
      const quantityInput = document.createElement("input");
      quantityInput.className = "display-quantity-input";
      quantityInput.type = "text";
      quantityInput.inputMode = "numeric";
      quantityInput.pattern = "[0-9]*";
      quantityInput.maxLength = 4;
      quantityInput.value = item.quantity;
      quantityInput.dataset.displayQuantityCode = item.code;
      quantityInput.setAttribute("aria-label", `Cantidad de display para ${item.code}`);

      const removeButton = document.createElement("button");
      removeButton.className = "display-remove-button";
      removeButton.type = "button";
      removeButton.dataset.removeDisplayCode = item.code;
      removeButton.textContent = "Eliminar";

      codeBlock.append(label, code);
      quantityField.append(quantityLabel, quantityInput);
      row.append(codeBlock, quantityField, removeButton);
      fragment.append(row);
    }

    elements.displayList.replaceChildren(fragment);
    elements.displayCount.textContent = `${items.length} ${items.length === 1 ? "producto" : "productos"}`;
    elements.displayEmptyMessage.hidden = items.length > 0;
  }

  function renderChecklist() {
    const products = filteredProducts();
    const fragment = document.createDocumentFragment();

    for (const product of products) {
      const item = document.createElement("li");
      item.className = `code-row${product.reviewed ? " is-reviewed" : ""}`;

      const rowMain = document.createElement("div");
      rowMain.className = "code-row-main";

      const checkControl = document.createElement("label");
      checkControl.className = "code-check-control";

      const checkbox = document.createElement("input");
      checkbox.className = "code-checkbox";
      checkbox.type = "checkbox";
      checkbox.checked = product.reviewed;
      checkbox.dataset.code = product.code;
      checkbox.setAttribute("aria-label", `${product.reviewed ? "Desmarcar" : "Marcar"} código ${product.code}`);

      const detailsButton = document.createElement("button");
      detailsButton.className = "code-details-button";
      detailsButton.type = "button";
      detailsButton.dataset.detailsCode = product.code;
      detailsButton.setAttribute(
        "aria-label",
        `Ver detalles del código ${product.code}, INV ${product.inv}, cantidad CGO ${product.cgoQty}, ${
          product.reviewed ? "revisado" : "pendiente"
        }`,
      );

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

      const chevron = document.createElement("span");
      chevron.className = "code-chevron";
      chevron.setAttribute("aria-hidden", "true");
      chevron.textContent = "›";

      top.append(value, state);
      content.append(top, meta);
      checkControl.append(checkbox);
      detailsButton.append(content, chevron);
      rowMain.append(checkControl, detailsButton);
      item.append(rowMain);
      fragment.append(item);
    }

    elements.codeList.replaceChildren(fragment);
    elements.emptyFilterMessage.hidden = products.length > 0;
  }

  function renderSearchResult() {
    if (activeTab !== "cgo") {
      elements.searchResult.hidden = true;
      elements.checklistSection.hidden = true;
      return;
    }

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
    if (shouldReview) {
      product.reviewedAt = Date.now();
    } else {
      delete product.reviewedAt;
    }
    saveVisit();
    renderProgress();
    renderChecklist();
    if (selectedProductCode === code) {
      renderProductDetail(product);
    }
  }

  function renderProductDetail(product) {
    elements.detailCode.textContent = product.code;
    elements.detailInv.textContent = product.inv;
    elements.detailCgoQty.textContent = product.cgoQty;
    elements.detailState.textContent = product.reviewed ? "Revisado" : "Pendiente";
    elements.detailState.classList.toggle("is-reviewed", product.reviewed);
    elements.detailAction.classList.toggle("is-unmark", product.reviewed);
    elements.detailAction.textContent = product.reviewed ? "↶ Desmarcar" : "✓ Marcar como revisado";
    elements.detailAction.dataset.code = product.code;
  }

  function showProductDetail(code, updateHistory = true) {
    const product = findProduct(code);
    if (!product) {
      return;
    }

    selectedProductCode = code;
    lastOpenedProductCode = code;
    renderProductDetail(product);
    elements.visitHeader.hidden = true;
    elements.appTabs.hidden = true;
    elements.searchCard.hidden = true;
    elements.checklistSection.hidden = true;
    elements.displaySection.hidden = true;
    elements.productDetailView.hidden = false;

    if (updateHistory) {
      window.history.pushState({ orderCheckDetail: code }, "", `#product-${code}`);
    }

    window.scrollTo({ top: 0, behavior: "auto" });
    elements.detailBackButton.focus({ preventScroll: true });
  }

  function showVisitHome({ restoreFocus = false } = {}) {
    selectedProductCode = null;
    elements.productDetailView.hidden = true;
    elements.visitHeader.hidden = false;
    elements.appTabs.hidden = false;
    renderTabs();

    const showingCgo = activeTab === "cgo";
    elements.searchCard.hidden = !showingCgo;
    elements.displaySection.hidden = showingCgo;
    if (showingCgo) {
      renderSearchResult();
    } else {
      elements.checklistSection.hidden = true;
      elements.searchResult.hidden = true;
      renderDisplayList();
    }

    if (restoreFocus && showingCgo && lastOpenedProductCode) {
      const rowButton = elements.codeList.querySelector(`[data-details-code="${lastOpenedProductCode}"]`);
      rowButton?.focus({ preventScroll: true });
    }
  }

  function returnToList() {
    if (window.history.state?.orderCheckDetail) {
      window.history.back();
      return;
    }

    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    showVisitHome({ restoreFocus: true });
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
    displayItems = [];
    localStorage.removeItem(DISPLAY_STORAGE_KEY);
    activeFilter = "all";
    activeTab = "cgo";
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

  elements.codeList.addEventListener("click", (event) => {
    const detailsButton = event.target.closest("button[data-details-code]");
    if (!detailsButton) {
      return;
    }
    showProductDetail(detailsButton.dataset.detailsCode);
  });

  elements.detailBackButton.addEventListener("click", returnToList);

  elements.detailAction.addEventListener("click", () => {
    const product = findProduct(elements.detailAction.dataset.code);
    if (!product) {
      return;
    }
    setReviewed(product.code, !product.reviewed);
  });

  window.addEventListener("popstate", () => {
    const code = productCodeFromHash();
    if (code && findProduct(code)) {
      showProductDetail(code, false);
    } else {
      showVisitHome({ restoreFocus: true });
    }
  });

  for (const button of elements.filterButtons) {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      renderFilters();
      renderChecklist();
    });
  }

  for (const button of elements.tabButtons) {
    button.addEventListener("click", () => {
      activeTab = button.dataset.appTab;
      showVisitHome();
      (activeTab === "display" ? elements.displayCodeInput : elements.searchInput).focus({ preventScroll: true });
    });
  }

  elements.displayForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const code = core.sanitizeCodeInput(elements.displayCodeInput.value);
    const quantity = normalizeDisplayQuantity(elements.displayQuantityInput.value);

    if (code.length !== 4) {
      elements.displayMessage.textContent = "Escribe un código válido de 4 dígitos.";
      elements.displayCodeInput.focus();
      return;
    }
    if (!findProduct(code)) {
      elements.displayMessage.textContent = "Ese código no está en la lista CGO actual.";
      elements.displayCodeInput.focus();
      return;
    }
    if (!quantity) {
      elements.displayMessage.textContent = "Escribe una cantidad mayor que 0.";
      elements.displayQuantityInput.focus();
      return;
    }

    const existing = displayItems.find((item) => item.code === code);
    if (existing) {
      existing.quantity = quantity;
      existing.addedAt = Date.now();
      elements.displayMessage.textContent = `Cantidad de ${code} actualizada.`;
    } else {
      displayItems.push({ code, quantity, addedAt: Date.now() });
      elements.displayMessage.textContent = `${code} agregado a Display.`;
    }
    saveDisplayItems();
    renderDisplayList();
    elements.displayCodeInput.value = "";
    elements.displayQuantityInput.value = "1";
    elements.displayCodeInput.focus({ preventScroll: true });
  });

  elements.displayCodeInput.addEventListener("input", () => {
    elements.displayCodeInput.value = core.sanitizeCodeInput(elements.displayCodeInput.value);
  });

  elements.displayQuantityInput.addEventListener("input", () => {
    elements.displayQuantityInput.value = String(elements.displayQuantityInput.value ?? "").replace(/\D/g, "").slice(0, 4);
  });

  elements.displayList.addEventListener("change", (event) => {
    const input = event.target.closest("input[data-display-quantity-code]");
    if (!input) return;
    const item = displayItems.find((entry) => entry.code === input.dataset.displayQuantityCode);
    const quantity = normalizeDisplayQuantity(input.value);
    if (!item || !quantity) {
      elements.displayMessage.textContent = "La cantidad debe ser mayor que 0.";
      renderDisplayList();
      return;
    }
    item.quantity = quantity;
    saveDisplayItems();
    elements.displayMessage.textContent = `Cantidad de ${item.code} actualizada.`;
    renderDisplayList();
  });

  elements.displayList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-remove-display-code]");
    if (!button) return;
    const code = button.dataset.removeDisplayCode;
    displayItems = displayItems.filter((item) => item.code !== code);
    saveDisplayItems();
    renderDisplayList();
    elements.displayMessage.textContent = `${code} eliminado de Display.`;
  });

  elements.newVisitButton.addEventListener("click", () => {
    const confirmed = window.confirm(
      "¿Iniciar una nueva visita? Se borrará la lista CGO actual y todos los checks.",
    );
    if (!confirmed) {
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(DISPLAY_STORAGE_KEY);
    visit = null;
    displayItems = [];
    activeFilter = "all";
    activeTab = "cgo";
    selectedProductCode = null;
    elements.searchInput.value = "";
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
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
