/*
  Predictive search script

  This file owns predictive-search requests, result rendering, loading state, and combobox keyboard interaction.
*/

import { SearchUpdateEvent } from "@shopify/standard-events";

class PredictiveSearch extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.form = this.querySelector(".predictive-search-form");
    this.input = this.querySelector(".predictive-search-input");
    this.resetButton = this.querySelector(".predictive-search-reset");
    this.submitButton = this.querySelector(".predictive-search-submit");
    this.submitIcon = this.querySelector("[data-predictive-search-submit-icon]");
    this.spinner = this.querySelector(".predictive-search-spinner-wrapper");
    this.results = this.querySelector(".predictive-search-results");
    this.status = this.querySelector("[data-predictive-search-status]");
    this.dialog = this.closest("dialog");
    this.footer = this.dialog?.querySelector("[data-predictive-search-footer]");
    this.footerLabel = this.footer?.querySelector("[data-predictive-search-footer-label]");

    if (
      !this.form ||
      !this.input ||
      !this.resetButton ||
      !this.submitButton ||
      !this.submitIcon ||
      !this.spinner ||
      !this.results ||
      !this.status ||
      !this.footer ||
      !this.footerLabel
    ) {
      return;
    }

    this.cache = new Map();
    this.currentIndex = -1;
    this.searchVersion = 0;
    this.listenerController = new AbortController();
    const { signal } = this.listenerController;

    this.input.addEventListener("input", this.onInput.bind(this), { signal });
    this.input.addEventListener("keydown", this.onKeydown.bind(this), {
      signal,
    });
    this.form.addEventListener("reset", this.onReset.bind(this), { signal });
    this.form.addEventListener("submit", this.onSubmit.bind(this), { signal });
    this.addEventListener("click", this.onClick.bind(this), { signal });

    if (this.dialog) {
      this.dialogObserver = new MutationObserver(this.onDialogStateChange.bind(this));
      this.dialogObserver.observe(this.dialog, {
        attributes: true,
        attributeFilter: ["open"],
      });
    }

    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.requestController?.abort();
    this.dialogObserver?.disconnect();
    window.clearTimeout(this.inputTimer);
    this.isInitialized = false;
  }

  onDialogStateChange() {
    if (this.dialog.open) {
      window.requestAnimationFrame(() => this.input.focus());
      return;
    }

    this.cancelPendingSearch();
    this.input.value = "";
    this.resetButton.hidden = true;
    this.clearResults();
    this.setLoading(false);
  }

  onInput() {
    const query = this.input.value.trim();

    this.cancelPendingSearch();
    this.resetButton.hidden = query.length === 0;
    this.clearResults();
    this.setLoading(false);

    if (!query) return;

    this.updateFooter(query);
    const searchVersion = this.searchVersion;

    this.inputTimer = window.setTimeout(() => this.fetchResults(query, searchVersion), 250);
  }

  onReset() {
    this.cancelPendingSearch();
    this.setLoading(false);

    window.requestAnimationFrame(() => {
      this.resetButton.hidden = true;
      this.clearResults();
      this.input.focus();
    });
  }

  onSubmit(event) {
    event.preventDefault();
    const url = new URL(this.form.action, window.location.origin);
    const formData = new FormData(this.form);

    for (const [name, value] of formData.entries()) {
      if (typeof value !== "string" || value.trim() === "") continue;

      url.searchParams.append(name, value);
    }

    this.submitSearch(url);
  }

  onClick(event) {
    const queryLink = event.target.closest("[data-predictive-search-query]");

    if (
      !queryLink ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      queryLink.target === "_blank" ||
      queryLink.hasAttribute("download")
    ) {
      return;
    }

    event.preventDefault();
    this.submitSearch(new URL(queryLink.href));
  }

  async submitSearch(url) {
    const searchView = document.querySelector("faceted-results[data-search-query]");

    this.cancelPendingSearch();
    this.setLoading(true);

    if (searchView) {
      const updated = await searchView.updateSearch(url, { focusResultsGrid: true }, this.form);

      this.setLoading(false);
      if (updated) this.closest("theme-dialog")?.requestClose?.();
      return;
    }

    const deferred = SearchUpdateEvent.createPromise();

    this.form.dispatchEvent(
      new SearchUpdateEvent({
        search: {
          query: url.searchParams.get("q") || "",
          productFilters: SearchUpdateEvent.parseProductFilters(url.searchParams),
          sortKey: SearchUpdateEvent.getSortKey(url.searchParams) || "RELEVANCE",
        },
        promise: deferred.promise,
      }),
    );

    this.requestController = new AbortController();
    const requestController = this.requestController;

    try {
      const response = await fetch(url.toString(), {
        headers: { "X-Requested-With": "XMLHttpRequest" },
        signal: requestController.signal,
      });

      if (!response.ok) throw new Error(`Failed to submit search: ${response.status}`);

      const html = await response.text();
      const documentFragment = new DOMParser().parseFromString(html, "text/html");
      const resultsGrid = documentFragment.querySelector("[data-faceted-results-grid]");

      if (!resultsGrid) throw new Error("Failed to find the submitted search results");

      deferred.resolve({ totalCount: Number(resultsGrid.dataset.resultCount) || 0 });
      window.location.assign(url.toString());
    } catch (error) {
      deferred.reject(error);

      if (error.name !== "AbortError") {
        console.error(error);
        window.location.assign(url.toString());
      }
    } finally {
      if (this.requestController === requestController) this.setLoading(false);
    }
  }

  onKeydown(event) {
    const options = this.getOptions();

    const hasSearchState = !this.results.hidden || !this.footer.hidden || !this.spinner.hidden;

    if (event.key === "Escape" && hasSearchState) {
      event.preventDefault();
      event.stopPropagation();
      this.cancelPendingSearch();
      this.setLoading(false);
      this.clearResults();
      this.input.focus();
      return;
    }

    if (!options.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.currentIndex = (this.currentIndex + 1) % options.length;
      this.setActiveOption(options);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.currentIndex = this.currentIndex <= 0 ? options.length - 1 : this.currentIndex - 1;
      this.setActiveOption(options);
      return;
    }

    if (event.key === "Enter" && this.currentIndex >= 0) {
      const option = options[this.currentIndex];
      const link = option.matches("a") ? option : option.querySelector("a");

      if (!link) return;

      event.preventDefault();
      link.click();
    }
  }

  getOptions() {
    return Array.from(this.results.querySelectorAll("[data-predictive-search-option]"));
  }

  setActiveOption(options) {
    options.forEach((option, index) => {
      option.setAttribute("aria-selected", String(index === this.currentIndex));
    });

    const activeOption = options[this.currentIndex];

    if (!activeOption) return;

    this.input.setAttribute("aria-activedescendant", activeOption.id);
    activeOption.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "nearest",
    });
  }

  async fetchResults(query, searchVersion) {
    if (!this.isCurrentSearch(query, searchVersion)) return;

    const cacheKey = query.toLocaleLowerCase();
    const cachedResults = this.cache.get(cacheKey);

    this.requestController?.abort();

    if (cachedResults) {
      this.setLoading(false);
      this.renderResults(cachedResults);
      return;
    }

    this.requestController = new AbortController();
    const requestController = this.requestController;
    const url = new URL(this.dataset.route, window.location.origin);

    url.searchParams.set("q", query);
    url.searchParams.set("resources[type]", this.dataset.resourceTypes);
    url.searchParams.set("resources[limit]", this.dataset.limit);
    url.searchParams.set("resources[limit_scope]", "each");
    url.searchParams.set("section_id", "predictive-search");

    this.setLoading(true);

    try {
      const response = await fetch(url.toString(), {
        headers: { "X-Requested-With": "XMLHttpRequest" },
        signal: requestController.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to load predictive search: ${response.status}`);
      }

      const html = await response.text();
      const documentFragment = new DOMParser().parseFromString(html, "text/html");
      const section = documentFragment.querySelector("#shopify-section-predictive-search");

      if (!section) {
        throw new Error("Failed to find predictive search markup");
      }

      if (this.requestController !== requestController || !this.isCurrentSearch(query, searchVersion)) {
        return;
      }

      this.cache.set(cacheKey, section.innerHTML);
      this.renderResults(section.innerHTML);
    } catch (error) {
      if (error.name === "AbortError") return;
      if (!this.isCurrentSearch(query, searchVersion)) return;

      console.error(error);
      this.clearResults();
      this.updateFooter(query);
    } finally {
      if (this.requestController === requestController && this.searchVersion === searchVersion) {
        this.setLoading(false);
      }
    }
  }

  renderResults(markup) {
    this.results.innerHTML = markup;
    this.results.hidden = false;
    this.input.setAttribute("aria-expanded", "true");
    this.currentIndex = -1;
    this.input.removeAttribute("aria-activedescendant");

    const count = this.results.querySelector("[data-predictive-search-count]");

    this.status.textContent = count?.textContent.trim() || "";
  }

  clearResults() {
    this.results.innerHTML = "";
    this.results.hidden = true;
    this.results.removeAttribute("aria-busy");
    this.input.setAttribute("aria-expanded", "false");
    this.input.removeAttribute("aria-activedescendant");
    this.status.textContent = "";
    this.currentIndex = -1;
    this.clearFooter();
  }

  clearFooter() {
    this.footer.hidden = true;
  }

  updateFooter(query) {
    this.footerLabel.textContent = this.dataset.textViewAll.replace("__TERMS__", () => query);
    this.footer.hidden = false;
  }

  cancelPendingSearch() {
    window.clearTimeout(this.inputTimer);
    this.requestController?.abort();
    this.searchVersion += 1;
  }

  isCurrentSearch(query, searchVersion) {
    return this.dialog.open && this.searchVersion === searchVersion && this.input.value.trim() === query;
  }

  setLoading(isLoading) {
    this.spinner.hidden = !isLoading;
    this.submitIcon.hidden = isLoading;

    if (isLoading) {
      this.submitButton.setAttribute("aria-busy", "true");
      this.results.setAttribute("aria-busy", "true");
      this.status.textContent = this.dataset.textLoading;
      return;
    }

    this.submitButton.removeAttribute("aria-busy");
    this.results.removeAttribute("aria-busy");
  }
}

if (!customElements.get("predictive-search")) {
  customElements.define("predictive-search", PredictiveSearch);
}
