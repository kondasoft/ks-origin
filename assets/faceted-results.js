/*
  Faceted results script

  This file owns shared AJAX filtering, sorting, pagination, history, and interaction state for product-result pages.
*/

class FacetedResults extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.listenerController = new AbortController();
    window.addEventListener("popstate", this.onPopState.bind(this), {
      signal: this.listenerController.signal,
    });
    this.addEventListener("click", this.onClick.bind(this), {
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

  async update(url, { focusResultsGrid = false, scrollToResultsGrid = true, updateHistory = true } = {}) {
    const navigationUrl = new URL(url, window.location.origin);
    const requestUrl = new URL(navigationUrl);
    const currentResultsGrid = this.querySelector("[data-faceted-results-grid]");
    const filterState = this.captureFilterState();

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

      if (this.requestController !== requestController) return false;

      currentResultsGrid.replaceWith(nextResultsGrid);
      this.refreshDialogTriggers();
      this.replaceFilters(nextView, filterState);

      if (updateHistory) {
        window.history.pushState({}, "", navigationUrl.toString());
      }

      this.announceResultCount();

      if (scrollToResultsGrid) {
        this.scrollToResultsGrid({ focus: focusResultsGrid });
      }

      return true;
    } catch (error) {
      if (error.name === "AbortError") return false;

      console.error(error);
      window.location.assign(navigationUrl.toString());
      return false;
    } finally {
      if (this.requestController === requestController) {
        this.querySelector("[data-faceted-results-grid]")?.removeAttribute("aria-busy");
      }
    }
  }

  captureFilterState() {
    const filters = this.querySelector("facet-filters");

    if (!filters) return null;

    const dialogBody = filters.querySelector(".dialog-body");
    const activeElement = filters.contains(document.activeElement) ? document.activeElement : null;

    return {
      activeName: activeElement?.name || "",
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

    if (!currentFilters || !nextFilters) return;

    currentFilters.replaceWith(nextFilters);

    if (!filterState) return;

    nextFilters.querySelectorAll(".theme-collapse-details").forEach((details, index) => {
      if (typeof filterState.openGroups[index] === "boolean") {
        details.open = filterState.openGroups[index];
      }
    });

    const dialogBody = nextFilters.querySelector(".dialog-body");

    if (dialogBody) dialogBody.scrollTop = filterState.scrollTop;

    if (!filterState.activeName) return;

    const matchingInputs = nextFilters.querySelectorAll(`[name="${CSS.escape(filterState.activeName)}"]`);
    const matchingInput =
      Array.from(matchingInputs).find((input) => input.value === filterState.activeValue) || matchingInputs[0];

    matchingInput?.focus({ preventScroll: true });

    if (matchingInput?.type === "text") {
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

    if (!input || input.type === "text") return;

    this.updateResults();
  }

  onInput(event) {
    const input = event.target.closest('input[type="text"]');

    if (!input) return;

    window.clearTimeout(this.inputTimer);
    this.inputTimer = window.setTimeout(() => {
      this.updateResults();
    }, 500);
  }

  onClick(event) {
    const clearLink = event.target.closest("[data-facets-clear]");

    if (!clearLink) return;

    event.preventDefault();
    window.clearTimeout(this.inputTimer);
    const view = this.closest("faceted-results");
    const dialog = this.closest("theme-dialog");

    if (view) {
      view.update(new URL(clearLink.href), {
        scrollToResultsGrid: dialog?.dialog?.open !== true,
      });
    } else {
      window.location.assign(clearLink.href);
    }
  }

  getUrl() {
    const url = new URL(this.form.action, window.location.origin);
    const formData = new FormData(this.form);

    for (const [name, value] of formData.entries()) {
      if (typeof value !== "string" || value.trim() === "") continue;

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

    if (url.toString() === window.location.href) {
      if (closeDialog) this.closeDialogAndScroll(dialog, view);
      return;
    }

    const updated = await view.update(url, {
      scrollToResultsGrid: !shouldDeferScroll,
    });

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
      const updated = await view.update(url);

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
