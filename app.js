(function initOrderCheck() {
  "use strict";

  const APP_VERSION = "1.0.0";
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
      return core.normalizeStoredVisit(saved);
    } catch {
      return null;
    }
  }

  function saveVisit() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visit));
  }

  function reviewedSet() {
    return new Set(visit?.reviewed ?? []);
  }

  function setView() {
    const hasVisit = Boolean(visit?.codes.length);
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
    const reviewed = visit.reviewed.length;
    const total = visit.codes.length;
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

  function filteredCodes() {
    const reviewed = reviewedSet();
    if (activeFilter === "pending") {
      return visit.codes.filter((code) => !reviewed.has(code));
    }
    if (activeFilter === "reviewed") {
      return visit.codes.filter((code) => reviewed.has(code));
    }
    return visit.codes;
  }

  function renderChecklist() {
    const reviewed = reviewedSet();
    const codes = filteredCodes();
    const fragment = document.createDocumentFragment();

    for (const code of codes) {
      const isReviewed = reviewed.has(code);
      const item = document.createElement("li");
      item.className = `code-row${isReviewed ? " is-reviewed" : ""}`;

      const label = document.createElement("label");
      label.className = "code-label";

      const checkbox = document.createElement("input");
      checkbox.className = "code-checkbox";
      checkbox.type = "checkbox";
      checkbox.checked = isReviewed;
      checkbox.dataset.code = code;
      checkbox.setAttribute("aria-label", `${isReviewed ? "Desmarcar" : "Marcar"} código ${code}`);

      const value = document.createElement("span");
      value.className = "code-value";
      value.textContent = code;

      const state = document.createElement("span");
      state.className = "code-state";
      state.textContent = isReviewed ? "Revisado" : "Pendiente";

      label.append(checkbox, value, state);
      item.append(label);
      fragment.append(item);
    }

    elements.codeList.replaceChildren(fragment);
    elements.emptyFilterMessage.hidden = codes.length > 0;
  }

  function renderSearchResult() {
    const code = elements.searchInput.value;
    const complete = code.length === 4;
    elements.checklistSection.hidden = code.length > 0;
    elements.searchResult.hidden = !complete;

    if (!complete) {
      elements.searchResult.className = "search-result";
      return;
    }

    const exists = visit.codes.includes(code);
    if (!exists) {
      elements.searchResult.className = "search-result is-no";
      elements.resultTitle.textContent = "✕ CGO NO";
      elements.resultMessage.textContent = "Revisar para agregar al pedido.";
      elements.resultReviewedNote.hidden = true;
      elements.resultAction.hidden = true;
      return;
    }

    const isReviewed = reviewedSet().has(code);
    elements.searchResult.className = "search-result is-yes";
    elements.resultTitle.textContent = "✓ CGO SÍ";
    elements.resultMessage.textContent = "Ya está siendo pedido.";
    elements.resultReviewedNote.hidden = !isReviewed;
    elements.resultReviewedNote.textContent = "Este código ya estaba marcado como revisado.";
    elements.resultAction.hidden = false;
    elements.resultAction.classList.toggle("is-unmark", isReviewed);
    elements.resultAction.textContent = isReviewed ? "↶ Desmarcar" : "✓ Marcar como revisado";
    elements.resultAction.dataset.code = code;
  }

  function setReviewed(code, shouldReview) {
    const reviewed = reviewedSet();
    if (shouldReview) {
      reviewed.add(code);
    } else {
      reviewed.delete(code);
    }
    visit.reviewed = visit.codes.filter((item) => reviewed.has(item));
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
    const codes = core.parseCodes(elements.codesInput.value);
    if (codes.length === 0) {
      elements.setupMessage.textContent = "No encontré códigos válidos de exactamente 4 dígitos.";
      elements.codesInput.focus();
      return;
    }

    visit = { codes, reviewed: [] };
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
    if (!code || !visit.codes.includes(code)) {
      return;
    }
    const isReviewed = reviewedSet().has(code);
    setReviewed(code, !isReviewed);
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
