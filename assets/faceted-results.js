/*
  Faceted results script

  This file owns shared AJAX filtering, sorting, pagination, history, and interaction state for product-result pages.
*/

let standardEventsPromise;

// Load standard events lazily so filtering, sorting, and pagination still work if the module is blocked.
function loadStandardEvents() {
  standardEventsPromise ??= import("@shopify/standard-events").catch((error) => {
    console.warn("Shopify standard events are unavailable", error);
    return {};
  });

  return standardEventsPromise;
}

function getUrlWithoutHash(url) {
  const nextUrl = new URL(url, window.location.origin);

  nextUrl.hash = "";
  return nextUrl.toString();
}

class FacetedResults extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    loadStandardEvents();
    this.currentUrl = getUrlWithoutHash(window.location.href);
    this.listenerController = new AbortController();
    window.addEventListener("popstate", this.onPopState.bind(this), {
      signal: this.listenerController.signal,
    });
    this.addEventListener("click", this.onClick.bind(this), {
      signal: this.listenerController.signal,
    });
    this.addEventListener("submit", this.onSubmit.bind(this), {
      signal: this.listenerController.signal,
    });
    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.requestController?.abort();
    window.clearTimeout(this.announcementTimer);
    this.isInitialized = false;
  }

  onPopState() {
    // Fragment links, such as the skip link, fire popstate without changing the results.
    if (getUrlWithoutHash(window.location.href) === this.currentUrl) return;

    this.update(new URL(window.location.href), { updateHistory: false });
  }

  onClick(event) {
    const paginationLink = event.target.closest(".pagination a");

    if (
      !paginationLink ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      paginationLink.target === "_blank" ||
      paginationLink.hasAttribute("download")
    ) {
      return;
    }

    event.preventDefault();
    this.update(new URL(paginationLink.href), { focusResultsGrid: true });
  }

  onSubmit(event) {
    const form = event.target.closest("[data-search-submit-form]");

    if (!form || !this.contains(form)) return;

    event.preventDefault();
    const url = new URL(form.action, window.location.origin);
    const formData = new FormData(form);

    for (const [name, value] of formData.entries()) {
      if (typeof value !== "string" || value.trim() === "") continue;

      url.searchParams.append(name, value);
    }

    this.updateSearch(url, { focusResultsGrid: true }, form);
  }

  async update(
    url,
    { focusResultsGrid = false, scrollToResultsGrid = true, updateHistory = true, throwOnError = false } = {},
  ) {
    const navigationUrl = new URL(url, window.location.origin);
    const requestUrl = new URL(navigationUrl);
    const currentResultsGrid = this.querySelector("[data-faceted-results-grid]");

    this.requestController?.abort();
    this.requestController = new AbortController();
    const requestController = this.requestController;

    requestUrl.searchParams.set("section_id", this.dataset.sectionId);
    currentResultsGrid?.setAttribute("aria-busy", "true");

    try {
      const response = await fetch(requestUrl.toString(), {
        headers: { "X-Requested-With": "XMLHttpRequest" },
        signal: requestController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to update results: ${response.status}`);
      }

      const html = await response.text();
      const documentFragment = new DOMParser().parseFromString(html, "text/html");
      const nextView = documentFragment.querySelector("faceted-results");
      const nextResultsGrid = nextView?.querySelector("[data-faceted-results-grid]");

      if (!currentResultsGrid || !nextView || !nextResultsGrid) {
        throw new Error("Failed to find the updated results markup");
      }

      if (this.requestController !== requestController) {
        if (throwOnError) throw new DOMException("The results update was interrupted", "AbortError");

        return false;
      }

      // Capture filter state after the response so input typed during the request is kept.
      const filterState = this.captureFilterState();

      currentResultsGrid.replaceWith(nextResultsGrid);
      this.replaceFilters(nextView, filterState);
      this.refreshDialogTriggers();

      if (updateHistory) {
        window.history.pushState({}, "", navigationUrl.toString());
      }

      this.currentUrl = getUrlWithoutHash(navigationUrl);
      this.syncSearchState(navigationUrl, nextView);

      this.announceResultCount();

      if (scrollToResultsGrid) {
        this.scrollToResultsGrid({ focus: focusResultsGrid });
      }

      return true;
    } catch (error) {
      if (error.name === "AbortError") {
        if (throwOnError) throw error;

        return false;
      }

      console.error(error);
      window.location.assign(navigationUrl.toString());

      if (throwOnError) throw error;

      return false;
    } finally {
      if (this.requestController === requestController) {
        this.querySelector("[data-faceted-results-grid]")?.removeAttribute("aria-busy");
      }
    }
  }

  async updateCollection(url, options = {}, eventTarget = this) {
    if (!this.dataset.collectionHandle) return this.update(url, options);

    const navigationUrl = new URL(url, window.location.origin);
    const { CollectionUpdateEvent } = await loadStandardEvents();
    const deferred = CollectionUpdateEvent?.createPromise();
    const collectionId = Number(this.dataset.collectionId) || null;

    if (CollectionUpdateEvent) {
      eventTarget.dispatchEvent(
        new CollectionUpdateEvent({
          collection: {
            id: collectionId,
            handle: this.dataset.collectionHandle,
            productsCount: Number(this.dataset.collectionProductsCount) || 0,
          },
          productFilters: CollectionUpdateEvent.parseProductFilters(navigationUrl.searchParams),
          sortKey: CollectionUpdateEvent.getSortKey(navigationUrl.searchParams),
          promise: deferred.promise,
        }),
      );
    }

    try {
      await this.update(navigationUrl, { ...options, throwOnError: true });

      const productsCount = Number(this.querySelector("[data-faceted-results-grid]")?.dataset.resultCount) || 0;

      deferred?.resolve({ productsCount });
      return true;
    } catch (error) {
      deferred?.reject(error);
      return false;
    }
  }

  async updateSearch(url, options = {}, eventTarget = this) {
    const navigationUrl = new URL(url, window.location.origin);
    const { SearchUpdateEvent } = await loadStandardEvents();
    const deferred = SearchUpdateEvent?.createPromise();

    if (SearchUpdateEvent) {
      eventTarget.dispatchEvent(
        new SearchUpdateEvent({
          search: {
            query: navigationUrl.searchParams.get("q") || "",
            productFilters: SearchUpdateEvent.parseProductFilters(navigationUrl.searchParams),
            sortKey: SearchUpdateEvent.getSortKey(navigationUrl.searchParams) || "RELEVANCE",
          },
          promise: deferred.promise,
        }),
      );
    }

    try {
      await this.update(navigationUrl, { ...options, throwOnError: true });

      const totalCount = Number(this.querySelector("[data-faceted-results-grid]")?.dataset.resultCount) || 0;

      deferred?.resolve({ totalCount });
      return true;
    } catch (error) {
      deferred?.reject(error);
      return false;
    }
  }

  updateFromControls(url, options = {}, eventTarget = this) {
    if (this.dataset.collectionHandle) return this.updateCollection(url, options, eventTarget);
    if (this.dataset.searchQuery !== undefined) return this.updateSearch(url, options, eventTarget);

    return this.update(url, options);
  }

  syncSearchState(url, nextView) {
    if (this.dataset.searchQuery === undefined) return;

    // The header lives outside the replaced grid, including when restoring an unperformed search from history.
    this.dataset.searchQuery = url.searchParams.get("q") || "";
    const input = this.querySelector('[data-search-submit-form] [name="q"]');
    const heading = this.querySelector("[data-search-heading]");
    const nextHeading = nextView.querySelector("[data-search-heading]");

    if (input) input.value = this.dataset.searchQuery;
    if (heading && nextHeading) heading.textContent = nextHeading.textContent;
  }

  captureFilterState() {
    const filters = this.querySelector("facet-filters");

    if (!filters) return null;

    const dialogBody = filters.querySelector(".dialog-body");
    const activeElement = filters.contains(document.activeElement) ? document.activeElement : null;

    return {
      activeName: activeElement?.name || "",
      activeRangeType: activeElement?.dataset.rangeType || "",
      activeValue: activeElement?.value || "",
      openGroups: Array.from(filters.querySelectorAll(".theme-collapse-details"), (details) => details.open),
      scrollTop: dialogBody?.scrollTop || 0,
    };
  }

  refreshDialogTriggers() {
    const dialog = this.querySelector("theme-dialog");

    if (!dialog) return;

    dialog.bindTriggers?.(this);

    if (dialog.dialog?.open) {
      dialog.setExpandedState?.(true);
    }

    if (dialog.lastTrigger && !dialog.lastTrigger.isConnected) {
      dialog.lastTrigger = dialog.triggers?.[0] || null;
    }
  }

  replaceFilters(nextView, filterState) {
    const currentFilters = this.querySelector("facet-filters");
    const nextFilters = nextView.querySelector("facet-filters");

    if (!nextFilters) {
      currentFilters?.remove();
      return;
    }

    if (!currentFilters) {
      // A first search can introduce filters; retain their dialog and replace any empty drawer left by history.
      const nextDialog = nextFilters.closest("theme-dialog");
      const currentDialog = this.querySelector(".facets-dialog")?.closest("theme-dialog");

      if (currentDialog && nextDialog) {
        currentDialog.replaceWith(nextDialog);
      } else {
        this.append(nextDialog || nextFilters);
      }
      return;
    }

    currentFilters.replaceWith(nextFilters);

    if (!filterState) return;

    nextFilters.querySelectorAll(".theme-collapse-details").forEach((details, index) => {
      if (typeof filterState.openGroups[index] === "boolean") {
        details.open = filterState.openGroups[index];
      }
    });

    const dialogBody = nextFilters.querySelector(".dialog-body");

    if (dialogBody) dialogBody.scrollTop = filterState.scrollTop;

    if (!filterState.activeName) {
      const matchingRange = nextFilters.querySelector(
        `[data-range-type="${CSS.escape(filterState.activeRangeType)}"]`,
      );

      matchingRange?.focus({ preventScroll: true });
      return;
    }

    const matchingInputs = nextFilters.querySelectorAll(`[name="${CSS.escape(filterState.activeName)}"]`);
    const matchingInput =
      Array.from(matchingInputs).find((input) => input.value === filterState.activeValue) || matchingInputs[0];

    matchingInput?.focus({ preventScroll: true });

    if (matchingInput?.type === "text") {
      // Keep text typed while the request was in flight and queue another update for it.
      if (matchingInput.value !== filterState.activeValue) {
        matchingInput.value = filterState.activeValue;
        matchingInput.dispatchEvent(new Event("input", { bubbles: true }));
      }

      matchingInput.setSelectionRange(matchingInput.value.length, matchingInput.value.length);
    }
  }

  announceResultCount() {
    const status = this.querySelector("[data-faceted-results-status]");
    const resultsGrid = this.querySelector("[data-faceted-results-grid]");

    if (!status || !resultsGrid?.dataset.resultCountText) return;

    status.textContent = "";
    window.clearTimeout(this.announcementTimer);
    this.announcementTimer = window.setTimeout(() => {
      status.textContent = resultsGrid.dataset.resultCountText;
    }, 100);
  }

  scrollToResultsGrid({ focus = false } = {}) {
    const resultsGrid = this.querySelector("[data-faceted-results-grid]");

    if (!resultsGrid) return;

    const headerGroup = document.querySelector("#header-group");
    const headerBehavior = headerGroup?.dataset.headerBehavior;
    const isPageScrollLocked = document.body.dataset.scrollLocked === "true";
    const currentScrollY = isPageScrollLocked ? Number(document.body.dataset.scrollLockTop || 0) : window.scrollY;
    const resultsGridTop = resultsGrid.getBoundingClientRect().top + currentScrollY;
    const scrollMarginTop = Number.parseFloat(window.getComputedStyle(resultsGrid).scrollMarginTop);
    const isScrollingUp = resultsGridTop - (scrollMarginTop || 0) < currentScrollY;
    const shouldOffsetHeader = headerBehavior === "sticky" || (headerBehavior === "reveal" && isScrollingUp);
    const headerOffset = shouldOffsetHeader ? headerGroup.offsetHeight : 0;
    const targetScrollY = Math.max(resultsGridTop - headerOffset - (scrollMarginTop || 0), 0);

    if (isPageScrollLocked) {
      document.body.dataset.scrollLockTop = String(targetScrollY);
      document.body.style.top = `-${targetScrollY}px`;
    } else {
      window.scrollTo({
        top: targetScrollY,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    }

    if (focus) resultsGrid.focus({ preventScroll: true });
  }
}

if (!customElements.get("faceted-results")) {
  customElements.define("faceted-results", FacetedResults);
}

class FacetFilters extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.form = this.querySelector("[data-facets-form]");

    if (!this.form) return;

    this.listenerController = new AbortController();
    this.form.addEventListener("submit", this.onSubmit.bind(this), {
      signal: this.listenerController.signal,
    });
    this.form.addEventListener("change", this.onChange.bind(this), {
      signal: this.listenerController.signal,
    });
    this.form.addEventListener("input", this.onInput.bind(this), {
      signal: this.listenerController.signal,
    });
    this.form.addEventListener("click", this.onClick.bind(this), {
      signal: this.listenerController.signal,
    });
    this.initializePriceRanges();
    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    window.clearTimeout(this.inputTimer);
    this.isInitialized = false;
  }

  onSubmit(event) {
    event.preventDefault();
    window.clearTimeout(this.inputTimer);
    this.updateResults({ closeDialog: true });
  }

  onChange(event) {
    const input = event.target.closest("input, select");

    if (!input || input.type === "text" || input.type === "range") return;

    this.updateResults();
  }

  onInput(event) {
    const input = event.target.closest('input[type="text"], input[type="range"]');

    if (!input?.closest("[data-price-range]")) return;

    if (input.type === "range") {
      this.syncPriceRange(input.closest("[data-price-range]"), input.dataset.rangeType, true);
    } else {
      this.syncPriceRange(input.closest("[data-price-range]"));
    }

    window.clearTimeout(this.inputTimer);
    this.inputTimer = window.setTimeout(() => {
      this.updateResults();
    }, 500);
  }

  initializePriceRanges() {
    this.querySelectorAll("[data-price-range]").forEach((priceRange) => {
      this.syncPriceRange(priceRange);
    });
  }

  getPriceRangeParts(priceRange) {
    return {
      minInput: priceRange.querySelector('[data-price-input="min"]'),
      maxInput: priceRange.querySelector('[data-price-input="max"]'),
      minRange: priceRange.querySelector('[data-range-type="min"]'),
      maxRange: priceRange.querySelector('[data-range-type="max"]'),
    };
  }

  getPriceNumber(value, fallback = 0) {
    if (value === null || value === undefined || value === "") return fallback;

    const compactValue = String(value).trim().replace(/[^\d,.-]/g, "");

    if (!/\d/.test(compactValue)) return fallback;

    const commaIndex = compactValue.lastIndexOf(",");
    const dotIndex = compactValue.lastIndexOf(".");
    let normalizedValue = compactValue;

    if (commaIndex > -1 && dotIndex > -1) {
      normalizedValue = commaIndex > dotIndex
        ? compactValue.replace(/\./g, "").replace(",", ".")
        : compactValue.replace(/,/g, "");
    } else if (commaIndex > -1 || dotIndex > -1) {
      const separator = commaIndex > -1 ? "," : ".";
      const parts = compactValue.split(separator);
      const isStoreDecimal = separator === this.form?.dataset.decimalSeparator;
      // A single separator followed by exactly three digits is a thousands separator, unless it's the store's decimal.
      const isThousands = parts.length > 2 || (!isStoreDecimal && parts[1].length === 3);

      normalizedValue = isThousands ? parts.join("") : parts.join(".");
    }

    const number = Number(normalizedValue);
    return Number.isNaN(number) ? fallback : number;
  }

  getPriceInputNumber(input, fallback = 0) {
    return input ? this.getPriceNumber(input.value, fallback) : fallback;
  }

  syncPriceRange(priceRange, activeRangeType = null, updateTextInputs = false) {
    const { minInput, maxInput, minRange, maxRange } = this.getPriceRangeParts(priceRange);

    if (!minInput || !maxInput || !minRange || !maxRange) return;

    const minAllowed = this.getPriceNumber(minRange.min, 0);
    const maxAllowed = this.getPriceNumber(maxRange.max, this.getPriceNumber(minRange.max, 0));
    const minInputHasValue = minInput.value.trim() !== "";
    const maxInputHasValue = maxInput.value.trim() !== "";
    const minFallback = minInputHasValue ? this.getPriceInputNumber(minInput, minAllowed) : minAllowed;
    const maxFallback = maxInputHasValue ? this.getPriceInputNumber(maxInput, maxAllowed) : maxAllowed;
    let minValue = activeRangeType === "min"
      ? this.getPriceInputNumber(minRange, minFallback)
      : this.getPriceInputNumber(minInput, minFallback);
    let maxValue = activeRangeType === "max"
      ? this.getPriceInputNumber(maxRange, maxFallback)
      : this.getPriceInputNumber(maxInput, maxFallback);

    minValue = Math.min(Math.max(minValue, minAllowed), maxAllowed);
    maxValue = Math.min(Math.max(maxValue, minAllowed), maxAllowed);

    if (minValue > maxValue) {
      if (activeRangeType === "min") {
        maxValue = minValue;
      } else {
        minValue = maxValue;
      }
    }

    minRange.value = minValue;
    maxRange.value = maxValue;
    minRange.max = maxValue;
    maxRange.min = minValue;

    if (updateTextInputs && activeRangeType === "min") minInput.value = minValue;
    if (updateTextInputs && activeRangeType === "max") maxInput.value = maxValue;
  }

  onClick(event) {
    const clearLink = event.target.closest("[data-facets-clear]");

    if (!clearLink) return;

    event.preventDefault();
    window.clearTimeout(this.inputTimer);
    const view = this.closest("faceted-results");
    const dialog = this.closest("theme-dialog");

    if (view) {
      const url = new URL(clearLink.href);
      const options = {
        scrollToResultsGrid: dialog?.dialog?.open !== true,
      };

      view.updateFromControls(url, options, this.form);
    } else {
      window.location.assign(clearLink.href);
    }
  }

  getUrl() {
    const url = new URL(this.form.action, window.location.origin);
    const formData = new FormData(this.form);
    const priceInputNames = new Set(
      Array.from(this.form.querySelectorAll("[data-price-input]"), (input) => input.name),
    );

    for (const [name, value] of formData.entries()) {
      if (typeof value !== "string" || value.trim() === "") continue;

      if (priceInputNames.has(name)) {
        // Filter URLs need plain decimal prices, whatever the shopper typed.
        const price = this.getPriceNumber(value, null);

        if (price !== null) url.searchParams.append(name, String(price));
        continue;
      }

      url.searchParams.append(name, value);
    }

    url.searchParams.delete("page");
    return url;
  }

  async updateResults({ closeDialog = false } = {}) {
    const view = this.closest("faceted-results");
    const dialog = this.closest("theme-dialog");
    const url = this.getUrl();
    const shouldDeferScroll = dialog?.dialog?.open === true;

    if (!view) {
      window.location.assign(url.toString());
      return;
    }

    const currentUrl = new URL(window.location.href);

    // Parameter order and fragments do not change the normalized filters restored after a request.
    currentUrl.searchParams.sort();
    const normalizedUrl = new URL(url);

    normalizedUrl.searchParams.sort();

    if (getUrlWithoutHash(normalizedUrl) === getUrlWithoutHash(currentUrl)) {
      if (closeDialog) this.closeDialogAndScroll(dialog, view);
      return;
    }

    const options = {
      scrollToResultsGrid: !shouldDeferScroll,
    };
    const updated = await view.updateFromControls(url, options, this.form);

    if (updated && closeDialog && shouldDeferScroll) {
      this.closeDialogAndScroll(dialog, view);
    }
  }

  closeDialogAndScroll(dialog, view) {
    if (!dialog?.dialog?.open) {
      view.scrollToResultsGrid();
      return;
    }

    dialog.dialog.addEventListener("close", () => view.scrollToResultsGrid(), { once: true });
    dialog.requestClose?.();
  }
}

if (!customElements.get("facet-filters")) {
  customElements.define("facet-filters", FacetFilters);
}

class FacetSort extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.listenerController = new AbortController();
    this.addEventListener("change", this.onChange.bind(this), {
      signal: this.listenerController.signal,
    });
    this.addEventListener("keydown", this.onKeydown.bind(this), {
      signal: this.listenerController.signal,
    });
    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.isInitialized = false;
  }

  onKeydown(event) {
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight" ||
      event.key === "Home" ||
      event.key === "End" ||
      event.key === " "
    ) {
      this.keepDropdownOpen = true;
    }
  }

  async onChange(event) {
    const input = event.target.closest('input[name="sort_by"]');

    if (!input || !input.checked) return;

    const view = this.closest("faceted-results");
    const form = input.form;
    const url = new URL(form.action, window.location.origin);
    const formData = new FormData(form);
    const keepDropdownOpen = this.keepDropdownOpen === true;

    this.keepDropdownOpen = false;

    for (const [name, value] of formData.entries()) {
      if (typeof value !== "string" || value.trim() === "") continue;

      url.searchParams.append(name, value);
    }

    url.searchParams.delete("page");

    if (view) {
      const updated = await view.updateFromControls(url, {}, form);

      if (updated) {
        const nextDropdown = view.querySelector("facet-sort")?.closest("theme-dropdown");

        if (keepDropdownOpen) {
          nextDropdown?.open?.();
          nextDropdown?.querySelector('input[name="sort_by"]:checked')?.focus();
        } else {
          nextDropdown?.querySelector(".theme-dropdown-btn")?.focus();
        }
      }
    } else {
      window.location.assign(url.toString());
    }
  }
}

if (!customElements.get("facet-sort")) {
  customElements.define("facet-sort", FacetSort);
}
