(function initOrderCheck() {
  "use strict";

  const APP_VERSION = "1.8.1";
  const STORAGE_KEY = "order-check.visit.v1";
  const DISPLAY_STORAGE_KEY = "order-check.display.v1";
  const TITLE_STORAGE_KEY = "order-check.title-emojis.v1";
  const DAY_ORDER = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const core = window.OrderCheckCore;

  const elements = {
    setupView: document.querySelector("#setup-view"),
    visitView: document.querySelector("#visit-view"),
    setupForm: document.querySelector("#setup-form"),
    codesInput: document.querySelector("#codes-input"),
    setupMessage: document.querySelector("#setup-message"),
    visitHeader: document.querySelector("#visit-header"),
    emojiTitleButton: document.querySelector("#emoji-title-button"),
    displayButton: document.querySelector("#display-button"),
    dayFilterButton: document.querySelector("#day-filter-button"),
    dayFilterMenu: document.querySelector("#day-filter-menu"),
    searchCard: document.querySelector("#search-card"),
    searchInput: document.querySelector("#search-input"),
    clearSearchButton: document.querySelector("#clear-search-button"),
    searchEnterButton: document.querySelector("#search-enter-button"),
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
    displayBackButton: document.querySelector("#display-back-button"),
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
    detailDay: document.querySelector("#detail-day"),
    detailState: document.querySelector("#detail-state"),
    detailInv: document.querySelector("#detail-inv"),
    detailCgoQty: document.querySelector("#detail-cgo-qty"),
    detailAction: document.querySelector("#detail-action"),
    filterButtons: [...document.querySelectorAll("[data-filter]")],
    newVisitButton: document.querySelector("#new-visit-button"),
    scrollTopButton: document.querySelector("#scroll-top-button"),
    appVersion: document.querySelector("#app-version"),
  };

  let visit = loadVisit();
  let displayItems = visit ? loadDisplayItems() : [];
  let activeFilter = "all";
  let activeDay = "ALL";
  let selectedProductKey = productKeyFromHash();
  let preserveSearchKeyboardOnNextDetail = false;
  let directOpenedRow = null;
  let directToggledCheckbox = null;
  let directSubmittedSearchAt = 0;
  let searchEnterSequence = null;

  if (!visit) {
    localStorage.removeItem(DISPLAY_STORAGE_KEY);
  }
  let lastOpenedProductKey = null;

  function productKeyFromHash() {
    const prefix = "#product-";
    if (!window.location.hash.startsWith(prefix)) return null;

    try {
      const raw = decodeURIComponent(window.location.hash.slice(prefix.length));
      if (/^\d{4}$/.test(raw)) return core.productKey(raw);
      const [code, day] = raw.split("|");
      return core.productKey(code, day);
    } catch {
      return null;
    }
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

  function keyForProduct(product) {
    return core.productKey(product?.code, product?.day);
  }

  function findProduct(key) {
    if (!key) return null;
    return visit?.products.find((product) => keyForProduct(product) === key) ?? null;
  }

  function productsForActiveDay() {
    if (activeDay === "ALL") return [...visit.products];
    return visit.products.filter((product) => product.day === activeDay);
  }

  function availableDays() {
    const present = new Set(
      visit.products
        .map((product) => product.day)
        .filter((day) => typeof day === "string" && day !== "-"),
    );
    return DAY_ORDER.filter((day) => present.has(day));
  }

  function getGraphemes(value) {
    const text = String(value ?? "").trim();
    if (!text) return [];
    if (typeof Intl?.Segmenter === "function") {
      return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map(
        (part) => part.segment,
      );
    }
    return Array.from(text);
  }

  function normalizeEmojiTitle(value) {
    const parts = getGraphemes(value);
    if (parts.length < 1 || parts.length > 3) return null;
    if (!parts.every((part) => /\p{Extended_Pictographic}/u.test(part))) return null;
    return parts.join("");
  }

  function loadEmojiTitle() {
    return normalizeEmojiTitle(localStorage.getItem(TITLE_STORAGE_KEY)) ?? "🚀👾";
  }

  function renderEmojiTitle() {
    elements.emojiTitleButton.textContent = loadEmojiTitle();
  }

  function renderDayMenu() {
    const days = availableDays();
    if (activeDay !== "ALL" && !days.includes(activeDay)) activeDay = "ALL";

    const fragment = document.createDocumentFragment();
    for (const day of ["ALL", ...days]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `day-menu-option${day === activeDay ? " is-active" : ""}`;
      button.dataset.day = day;
      button.setAttribute("aria-pressed", String(day === activeDay));
      button.textContent = day;
      fragment.append(button);
    }
    elements.dayFilterMenu.replaceChildren(fragment);
    elements.dayFilterButton.hidden = days.length === 0;
    elements.dayFilterButton.setAttribute(
      "aria-label",
      activeDay === "ALL" ? "Filtrar por día" : `Día seleccionado: ${activeDay}`,
    );
    elements.dayFilterButton.title =
      activeDay === "ALL" ? "Filtrar por día" : `Día: ${activeDay}`;
  }

  function setView() {
    const hasVisit = Boolean(visit?.products.length);
    elements.setupView.hidden = hasVisit;
    elements.visitView.hidden = !hasVisit;

    if (hasVisit) {
      renderEmojiTitle();
      renderDayMenu();
      renderFilters();
      renderVisit();
    } else {
      elements.codesInput.value = "";
      elements.setupMessage.textContent = "";
    }
  }

  function renderVisit() {
    renderDayMenu();
    renderFilters();
    renderChecklist();
    renderDisplayList();
    renderSearchResult();

    if (selectedProductKey && findProduct(selectedProductKey)) {
      showProductDetail(selectedProductKey, false);
    } else {
      selectedProductKey = null;
      showVisitHome();
    }
  }

  function renderFilters() {
    const dayProducts = productsForActiveDay();
    const counts = {
      all: dayProducts.length,
      pending: dayProducts.filter((product) => !product.reviewed).length,
      reviewed: dayProducts.filter((product) => product.reviewed).length,
    };
    const labels = {
      all: "Todos",
      pending: "Pendientes",
      reviewed: "Revisados",
    };

    for (const button of elements.filterButtons) {
      const filter = button.dataset.filter;
      const selected = filter === activeFilter;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.textContent = `${labels[filter]} (${counts[filter]})`;
    }
  }

  function filteredProducts() {
    let products = productsForActiveDay();

    if (activeFilter === "pending") {
      products = products.filter((product) => !product.reviewed);
    } else if (activeFilter === "reviewed") {
      products = products.filter((product) => product.reviewed);
    }

    const searchQuery = elements.searchInput?.value ?? "";
    if (searchQuery.length > 0) {
      products = products.filter((product) => product.code.startsWith(searchQuery));
    }

    if (activeFilter === "reviewed") {
      return products.sort((a, b) => (b.reviewedAt ?? 0) - (a.reviewedAt ?? 0));
    }

    return products.sort((a, b) => Number(a.code) - Number(b.code) || a.code.localeCompare(b.code));
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
    const items = [...displayItems].sort(
      (a, b) => Number(a.code) - Number(b.code) || a.code.localeCompare(b.code),
    );
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
      const productKey = keyForProduct(product);
      checkbox.checked = product.reviewed;
      checkbox.dataset.productKey = productKey;
      checkbox.setAttribute(
        "aria-label",
        `${product.reviewed ? "Desmarcar" : "Marcar"} código ${product.code}${
          product.day ? ` para ${product.day}` : ""
        }`,
      );

      const detailsButton = document.createElement("button");
      detailsButton.className = "code-details-button";
      detailsButton.type = "button";
      detailsButton.dataset.detailsKey = productKey;
      detailsButton.setAttribute(
        "aria-label",
        `Ver detalles del código ${product.code}${product.day ? `, día ${product.day}` : ""}, INV ${product.inv}, cantidad CGO ${product.cgoQty}`,
      );

      const content = document.createElement("span");
      content.className = "code-content";

      const top = document.createElement("span");
      top.className = "code-top";

      const value = document.createElement("span");
      value.className = "code-value";
      value.textContent = product.code;

      const day = document.createElement("span");
      day.className = "code-day";
      day.textContent = product.day ?? "";
      day.hidden = !product.day;

      const meta = document.createElement("span");
      meta.className = "code-meta";
      meta.append(createMetaItem("INV", product.inv), createMetaItem("QTY", product.cgoQty));

      const chevron = document.createElement("span");
      chevron.className = "code-chevron";
      chevron.setAttribute("aria-hidden", "true");
      chevron.textContent = "›";

      top.append(value);
      if (product.day) top.append(day);
      content.append(top, meta);
      // Keep the small details target on the left. The entire remaining
      // right side is one large checkbox target for fast one-handed use.
      detailsButton.append(chevron);
      checkControl.append(content, checkbox);
      rowMain.append(detailsButton, checkControl);
      item.append(rowMain);
      fragment.append(item);
    }

    elements.codeList.replaceChildren(fragment);
    const hasSearch = elements.searchInput.value.length > 0;
    elements.emptyFilterMessage.textContent = hasSearch
      ? "No hay códigos que coincidan."
      : "No hay códigos en este filtro.";
    elements.emptyFilterMessage.hidden = products.length > 0;
  }

  function renderSearchResult() {
    // Search filters the normal product rows from the first digit onward.
    // While a searched product detail is open, keep the list hidden so the
    // focused search field can remain on screen without mixing both views.
    elements.searchResult.hidden = true;
    if (selectedProductKey) {
      elements.checklistSection.hidden = true;
      return;
    }
    elements.checklistSection.hidden = false;
    renderChecklist();
  }

  function setReviewed(key, shouldReview) {
    const product = findProduct(key);
    if (!product) {
      return;
    }
    product.reviewed = shouldReview;
    if (shouldReview) {
      product.reviewedAt = core.nextReviewedAt(visit.products);
    } else {
      delete product.reviewedAt;
    }
    saveVisit();
    renderFilters();
    renderChecklist();
    if (selectedProductKey === key) {
      renderProductDetail(product);
    }
  }

  function renderProductDetail(product) {
    const key = keyForProduct(product);
    elements.detailCode.textContent = product.code;
    elements.detailDay.textContent = product.day ?? "";
    elements.detailDay.hidden = !product.day;
    elements.detailInv.textContent = product.inv;
    elements.detailCgoQty.textContent = product.cgoQty;
    elements.detailState.textContent = product.reviewed ? "Revisado" : "Pendiente";
    elements.detailState.classList.toggle("is-reviewed", product.reviewed);
    elements.detailAction.classList.toggle("is-unmark", product.reviewed);
    elements.detailAction.textContent = product.reviewed ? "↶ Desmarcar" : "✓ Marcar como revisado";
    elements.detailAction.dataset.productKey = key;
  }

  function showProductDetail(key, updateHistory = true) {
    const product = findProduct(key);
    if (!product) {
      return;
    }

    const keepSearchKeyboard =
      preserveSearchKeyboardOnNextDetail &&
      elements.searchInput.value.length > 0 &&
      document.activeElement === elements.searchInput;
    preserveSearchKeyboardOnNextDetail = false;

    selectedProductKey = key;
    lastOpenedProductKey = key;
    renderProductDetail(product);
    elements.visitHeader.hidden = true;
    elements.searchCard.hidden = !keepSearchKeyboard;
    elements.checklistSection.hidden = true;
    elements.displaySection.hidden = true;
    elements.productDetailView.hidden = false;

    if (updateHistory) {
      window.history.pushState(
        { orderCheckDetail: key },
        "",
        `#product-${encodeURIComponent(key)}`,
      );
    }

    if (keepSearchKeyboard) {
      elements.searchInput.focus({ preventScroll: true });
    } else {
      window.scrollTo({ top: 0, behavior: "auto" });
      elements.detailBackButton.focus({ preventScroll: true });
    }
  }

  function showVisitHome({ restoreFocus = false } = {}) {
    selectedProductKey = null;
    elements.productDetailView.hidden = true;
    elements.displaySection.hidden = true;
    elements.visitHeader.hidden = false;
    elements.searchCard.hidden = false;
    elements.checklistSection.hidden = false;
    renderDayMenu();
    renderFilters();
    renderSearchResult();

    if (restoreFocus && elements.searchInput.value.length > 0) {
      elements.searchInput.focus({ preventScroll: true });
    } else if (restoreFocus && lastOpenedProductKey) {
      const rowButton = [...elements.codeList.querySelectorAll("[data-details-key]")].find(
        (button) => button.dataset.detailsKey === lastOpenedProductKey,
      );
      rowButton?.focus({ preventScroll: true });
    }
  }

  function showDisplayView() {
    selectedProductKey = null;
    elements.productDetailView.hidden = true;
    elements.visitHeader.hidden = true;
    elements.searchCard.hidden = true;
    elements.checklistSection.hidden = true;
    elements.searchResult.hidden = true;
    elements.displaySection.hidden = false;
    renderDisplayList();
    window.scrollTo({ top: 0, behavior: "auto" });
    elements.displayBackButton.focus({ preventScroll: true });
  }

  function returnToList() {
    if (window.history.state?.orderCheckDetail) {
      window.history.back();
      return;
    }

    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    showVisitHome({ restoreFocus: true });
  }

  function syncClearSearchButton() {
    elements.clearSearchButton.hidden = elements.searchInput.value.length === 0;
  }

  function resetSearchEnterSequence() {
    searchEnterSequence = null;
  }

  function getSearchEnterSequence() {
    const query = elements.searchInput.value;
    if (!query) {
      return null;
    }

    if (
      !searchEnterSequence ||
      searchEnterSequence.query !== query ||
      searchEnterSequence.filter !== activeFilter ||
      searchEnterSequence.day !== activeDay
    ) {
      searchEnterSequence = {
        query,
        filter: activeFilter,
        day: activeDay,
        queue: core.createSelectionSequence(filteredProducts()),
      };
    }

    return searchEnterSequence;
  }

  function hasNextSearchEnterResult() {
    const sequence = getSearchEnterSequence();
    return Boolean(sequence && !core.selectionSequenceComplete(sequence.queue));
  }

  function syncSearchEnterButton() {
    const searchFocused =
      document.activeElement === elements.searchInput &&
      !elements.searchCard.hidden;
    const hasQuery = elements.searchInput.value.length > 0;
    const hasResult = hasQuery && hasNextSearchEnterResult();

    elements.searchEnterButton.hidden = !searchFocused;
    elements.searchEnterButton.disabled = !hasResult;
    elements.searchEnterButton.setAttribute("aria-disabled", String(!hasResult));
  }

  function updateKeyboardInset() {
    const viewport = window.visualViewport;
    if (!viewport) {
      document.documentElement.style.setProperty("--keyboard-inset", "0px");
      return;
    }

    const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    document.documentElement.style.setProperty("--keyboard-inset", `${inset}px`);
  }

  function submitNextSearchResult() {
    const sequence = getSearchEnterSequence();
    if (!sequence) {
      return;
    }

    const key = core.takeNextSelectionKey(sequence.queue);
    if (!key) {
      syncSearchEnterButton();
      return;
    }

    const product = findProduct(key);
    if (product) {
      setReviewed(key, !product.reviewed);
    }

    if (core.selectionSequenceComplete(sequence.queue)) {
      clearSearch({ refocus: true });
      return;
    }

    // Keep the same search active between Enter presses so the next press
    // selects the next row from the original top-to-bottom result order.
    elements.searchInput.focus({ preventScroll: true });
    syncSearchEnterButton();
  }

  function clearSearch({ refocus = false } = {}) {
    elements.searchInput.value = "";
    resetSearchEnterSequence();
    syncClearSearchButton();
    renderSearchResult();
    if (refocus) {
      elements.searchInput.focus({ preventScroll: true });
    }
    syncSearchEnterButton();
  }

  function clearSearchAndRefocus() {
    clearSearch({ refocus: true });
  }

  function syncScrollTopButton() {
    elements.scrollTopButton.hidden =
      window.scrollY < 420 || document.activeElement === elements.searchInput;
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
    activeDay = "ALL";
    resetSearchEnterSequence();
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
    resetSearchEnterSequence();
    syncClearSearchButton();
    renderSearchResult();
    syncSearchEnterButton();
  });

  elements.searchInput.addEventListener("focus", () => {
    updateKeyboardInset();
    syncSearchEnterButton();
    syncScrollTopButton();
  });

  elements.searchInput.addEventListener("blur", () => {
    window.setTimeout(() => {
      updateKeyboardInset();
      syncSearchEnterButton();
      syncScrollTopButton();
    }, 0);
  });

  elements.searchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    if (event.repeat) {
      return;
    }
    event.preventDefault();
    submitNextSearchResult();
  });

  elements.clearSearchButton.addEventListener("click", clearSearchAndRefocus);

  function submitSearchFromFloatingButton(event) {
    const now = Date.now();

    // touchstart may be followed by synthetic mouse/click events. Ignore those
    // follow-ups so one physical tap can never advance two rows.
    if (event.type !== "touchstart" && now - directSubmittedSearchAt < 1200) {
      event.preventDefault();
      return;
    }

    if (elements.searchEnterButton.disabled) {
      return;
    }

    event.preventDefault();
    directSubmittedSearchAt = now;
    submitNextSearchResult();
  }

  elements.searchEnterButton.addEventListener(
    "touchstart",
    submitSearchFromFloatingButton,
    { passive: false },
  );
  elements.searchEnterButton.addEventListener("mousedown", submitSearchFromFloatingButton);
  elements.searchEnterButton.addEventListener("click", (event) => {
    if (Date.now() - directSubmittedSearchAt < 1200) {
      event.preventDefault();
      return;
    }
    submitNextSearchResult();
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", updateKeyboardInset);
    window.visualViewport.addEventListener("scroll", updateKeyboardInset);
  }

  elements.resultAction.addEventListener("click", () => {
    const code = elements.resultAction.dataset.code;
    const product = code ? filteredProducts().find((item) => item.code === code) : null;
    if (!product) return;
    setReviewed(keyForProduct(product), !product.reviewed);
    clearSearchAndRefocus();
  });

  elements.codeList.addEventListener("change", (event) => {
    const checkbox = event.target.closest("input[data-product-key]");
    if (!checkbox) {
      return;
    }

    const key = checkbox.dataset.productKey;
    if (directToggledCheckbox === checkbox) {
      directToggledCheckbox = null;
      return;
    }

    const hadSearch = elements.searchInput.value.length > 0;
    setReviewed(key, checkbox.checked);
    if (hadSearch) {
      clearSearch();
    }
  });

  function toggleSearchCheckboxBeforeBlur(event) {
    const checkControl = event.target.closest(".code-check-control");
    const checkbox = checkControl?.querySelector("input[data-product-key]");
    if (
      !checkbox ||
      elements.searchInput.value.length === 0 ||
      document.activeElement !== elements.searchInput
    ) {
      return;
    }

    // A native checkbox normally takes focus on iOS, which dismisses the
    // numeric keyboard. Toggle it ourselves at the start of the gesture and
    // cancel the native focus transfer so the search field stays active.
    event.preventDefault();
    const key = checkbox.dataset.productKey;
    const product = findProduct(key);
    if (!product) {
      return;
    }

    // Keep a reference to the exact DOM checkbox involved in this gesture.
    // This suppresses only a synthetic follow-up event from the same tap,
    // never a legitimate second tap on the newly rendered row.
    directToggledCheckbox = checkbox;
    setReviewed(key, !product.reviewed);
    clearSearch({ refocus: true });
  }

  elements.codeList.addEventListener("touchstart", toggleSearchCheckboxBeforeBlur, { passive: false });
  elements.codeList.addEventListener("mousedown", toggleSearchCheckboxBeforeBlur);

  function openSearchResultBeforeBlur(event) {
    const detailsButton = event.target.closest("button[data-details-key]");
    if (
      !detailsButton ||
      elements.searchInput.value.length === 0 ||
      document.activeElement !== elements.searchInput
    ) {
      return;
    }

    // iOS Safari normally blurs the input late in the tap sequence. Open the
    // result during the initial touch/mouse gesture and cancel the default
    // focus transfer so the numeric keyboard stays attached to the search.
    event.preventDefault();
    const key = detailsButton.dataset.detailsKey;
    directOpenedRow = { key, at: Date.now() };
    preserveSearchKeyboardOnNextDetail = true;
    showProductDetail(key);
  }

  elements.codeList.addEventListener("touchstart", openSearchResultBeforeBlur, { passive: false });
  elements.codeList.addEventListener("mousedown", openSearchResultBeforeBlur);

  elements.codeList.addEventListener("click", (event) => {
    const detailsButton = event.target.closest("button[data-details-key]");
    if (!detailsButton) {
      return;
    }

    const key = detailsButton.dataset.detailsKey;
    if (directOpenedRow?.key === key && Date.now() - directOpenedRow.at < 1200) {
      return;
    }

    directOpenedRow = null;
    showProductDetail(key);
  });

  for (const button of [elements.detailBackButton, elements.detailAction]) {
    button.addEventListener("pointerdown", (event) => {
      if (!elements.searchCard.hidden && document.activeElement === elements.searchInput) {
        event.preventDefault();
      }
    });
  }

  elements.detailBackButton.addEventListener("click", returnToList);

  elements.detailAction.addEventListener("click", () => {
    const product = findProduct(elements.detailAction.dataset.productKey);
    if (!product) {
      return;
    }
    setReviewed(keyForProduct(product), !product.reviewed);
  });

  window.addEventListener("popstate", () => {
    const key = productKeyFromHash();
    if (key && findProduct(key)) {
      showProductDetail(key, false);
    } else {
      showVisitHome({ restoreFocus: true });
    }
  });

  for (const button of elements.filterButtons) {
    button.addEventListener("click", () => {
      resetSearchEnterSequence();
      activeFilter = button.dataset.filter;
      renderFilters();
      renderChecklist();
      syncSearchEnterButton();
    });
  }

  elements.dayFilterButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = elements.dayFilterMenu.hidden;
    elements.dayFilterMenu.hidden = !willOpen;
    elements.dayFilterButton.setAttribute("aria-expanded", String(willOpen));
  });

  elements.dayFilterMenu.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-day]");
    if (!button) return;

    activeDay = button.dataset.day;
    resetSearchEnterSequence();
    elements.dayFilterMenu.hidden = true;
    elements.dayFilterButton.setAttribute("aria-expanded", "false");
    renderDayMenu();
    renderFilters();
    renderChecklist();
    syncSearchEnterButton();
  });

  document.addEventListener("click", (event) => {
    if (
      !elements.dayFilterMenu.hidden &&
      !elements.dayFilterMenu.contains(event.target) &&
      event.target !== elements.dayFilterButton
    ) {
      elements.dayFilterMenu.hidden = true;
      elements.dayFilterButton.setAttribute("aria-expanded", "false");
    }
  });

  elements.emojiTitleButton.addEventListener("click", () => {
    const current = loadEmojiTitle();
    const value = window.prompt("Elige de 1 a 3 emojis para el título:", current);
    if (value === null) return;

    const normalized = normalizeEmojiTitle(value);
    if (!normalized) {
      window.alert("Usa solamente de 1 a 3 emojis.");
      return;
    }

    localStorage.setItem(TITLE_STORAGE_KEY, normalized);
    renderEmojiTitle();
  });

  elements.displayButton.addEventListener("click", showDisplayView);
  elements.displayBackButton.addEventListener("click", () => {
    showVisitHome();
    elements.displayButton.focus({ preventScroll: true });
  });

  elements.displayForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const code = core.sanitizeCodeInput(elements.displayCodeInput.value);
    const quantity = normalizeDisplayQuantity(elements.displayQuantityInput.value);

    if (code.length !== 4) {
      elements.displayMessage.textContent = "Escribe un código válido de 4 dígitos.";
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

  window.addEventListener("scroll", syncScrollTopButton, { passive: true });
  elements.scrollTopButton.addEventListener("click", () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
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
    activeDay = "ALL";
    resetSearchEnterSequence();
    selectedProductKey = null;
    elements.searchInput.value = "";
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    setView();
    elements.codesInput.focus({ preventScroll: true });
  });

  window.addEventListener("pageshow", () => {
    if (visit?.products.length) {
      renderDayMenu();
      renderFilters();
      if (!elements.checklistSection.hidden) {
        renderChecklist();
      }
    }
  });

  renderEmojiTitle();
  elements.appVersion.textContent = `v${APP_VERSION}`;
  updateKeyboardInset();
  syncClearSearchButton();
  syncSearchEnterButton();
  syncScrollTopButton();
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
