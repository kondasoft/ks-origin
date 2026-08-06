/*
  Main collection script

  This file owns interactive behavior specific to collection utilities and product-grid controls.
  Keep reusable interface components in the shared components script.
*/


class CollectionView extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.listenerController = new AbortController();
    window.addEventListener("popstate", this.onPopState.bind(this), {
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

  async update(url, { updateHistory = true } = {}) {
    const navigationUrl = new URL(url, window.location.origin);
    const requestUrl = new URL(navigationUrl);
    const currentProductGrid = this.querySelector(
      "[data-collection-product-grid]",
    );
    const filterState = this.captureFilterState();

    this.requestController?.abort();
    this.requestController = new AbortController();
    const requestController = this.requestController;

    requestUrl.searchParams.set("section_id", this.dataset.sectionId);
    currentProductGrid?.setAttribute("aria-busy", "true");

    try {
      const response = await fetch(requestUrl.toString(), {
        headers: { "X-Requested-With": "XMLHttpRequest" },
        signal: requestController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to update collection: ${response.status}`);
      }

      const html = await response.text();
      const documentFragment = new DOMParser().parseFromString(
        html,
        "text/html",
      );
      const nextView = documentFragment.querySelector("collection-view");
      const nextProductGrid = nextView?.querySelector(
        "[data-collection-product-grid]",
      );

      if (!currentProductGrid || !nextView || !nextProductGrid) {
        throw new Error("Failed to find the updated collection markup");
      }

      if (this.requestController !== requestController) return false;

      currentProductGrid.replaceWith(nextProductGrid);
      this.refreshDialogTriggers();
      this.replaceFilters(nextView, filterState);

      if (updateHistory) {
        window.history.pushState({}, "", navigationUrl.toString());
      }

      this.announceProductCount();
      return true;
    } catch (error) {
      if (error.name === "AbortError") return false;

      console.error(error);
      window.location.assign(navigationUrl.toString());
      return false;
    } finally {
      if (this.requestController === requestController) {
        this.querySelector("[data-collection-product-grid]")?.removeAttribute(
          "aria-busy",
        );
      }
    }
  }

  captureFilterState() {
    const filters = this.querySelector("collection-filters");

    if (!filters) return null;

    const dialogBody = filters.querySelector(".dialog-body");
    const activeElement = filters.contains(document.activeElement)
      ? document.activeElement
      : null;

    return {
      activeName: activeElement?.name || "",
      activeValue: activeElement?.value || "",
      openGroups: Array.from(
        filters.querySelectorAll(".theme-collapse-details"),
        (details) => details.open,
      ),
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
    const currentFilters = this.querySelector("collection-filters");
    const nextFilters = nextView.querySelector("collection-filters");

    if (!currentFilters || !nextFilters) return;

    currentFilters.replaceWith(nextFilters);

    if (!filterState) return;

    nextFilters
      .querySelectorAll(".theme-collapse-details")
      .forEach((details, index) => {
        if (typeof filterState.openGroups[index] === "boolean") {
          details.open = filterState.openGroups[index];
        }
      });

    const dialogBody = nextFilters.querySelector(".dialog-body");

    if (dialogBody) dialogBody.scrollTop = filterState.scrollTop;

    if (!filterState.activeName) return;

    const matchingInputs = nextFilters.querySelectorAll(
      `[name="${CSS.escape(filterState.activeName)}"]`,
    );
    const matchingInput = Array.from(matchingInputs).find(
      (input) => input.value === filterState.activeValue,
    ) || matchingInputs[0];

    matchingInput?.focus({ preventScroll: true });

    if (matchingInput?.type === "text") {
      matchingInput.setSelectionRange(
        matchingInput.value.length,
        matchingInput.value.length,
      );
    }
  }

  announceProductCount() {
    const status = this.querySelector("[data-collection-status]");
    const productGrid = this.querySelector("[data-collection-product-grid]");

    if (!status || !productGrid?.dataset.productCountText) return;

    status.textContent = "";
    window.clearTimeout(this.announcementTimer);
    this.announcementTimer = window.setTimeout(() => {
      status.textContent = productGrid.dataset.productCountText;
    }, 100);
  }
}

if (!customElements.get("collection-view")) {
  customElements.define("collection-view", CollectionView);
}


class CollectionFilters extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.form = this.querySelector("[data-collection-filters-form]");

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
    this.updateCollection({ closeDialog: true });
  }

  onChange(event) {
    const input = event.target.closest("input, select");

    if (!input || input.type === "text") return;

    this.updateCollection();
  }

  onInput(event) {
    const input = event.target.closest('input[type="text"]');

    if (!input) return;

    window.clearTimeout(this.inputTimer);
    this.inputTimer = window.setTimeout(() => {
      this.updateCollection();
    }, 500);
  }

  onClick(event) {
    const clearLink = event.target.closest("[data-collection-filter-clear]");

    if (!clearLink) return;

    event.preventDefault();
    window.clearTimeout(this.inputTimer);
    const view = this.closest("collection-view");

    if (view) {
      view.update(new URL(clearLink.href));
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

  async updateCollection({ closeDialog = false } = {}) {
    const view = this.closest("collection-view");
    const dialog = this.closest("theme-dialog");
    const url = this.getUrl();

    if (!view) {
      window.location.assign(url.toString());
      return;
    }

    if (url.toString() === window.location.href) {
      if (closeDialog) dialog?.requestClose?.();
      return;
    }

    const updated = await view.update(url);

    if (updated && closeDialog) dialog?.requestClose?.();
  }
}

if (!customElements.get("collection-filters")) {
  customElements.define("collection-filters", CollectionFilters);
}


class CollectionSort extends HTMLElement {
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

    const view = this.closest("collection-view");
    const url = new URL(window.location.href);
    const keepDropdownOpen = this.keepDropdownOpen === true;

    this.keepDropdownOpen = false;

    url.searchParams.set("sort_by", input.value);
    url.searchParams.delete("page");

    if (view) {
      const updated = await view.update(url);

      if (updated) {
        const nextDropdown = view
          .querySelector("collection-sort")
          ?.closest("theme-dropdown");

        if (keepDropdownOpen) {
          nextDropdown?.open?.();
          nextDropdown
            ?.querySelector('input[name="sort_by"]:checked')
            ?.focus();
        } else {
          nextDropdown?.querySelector(".theme-dropdown-btn")?.focus();
        }
      }
    } else {
      window.location.assign(url.toString());
    }
  }
}

if (!customElements.get("collection-sort")) {
  customElements.define("collection-sort", CollectionSort);
}
