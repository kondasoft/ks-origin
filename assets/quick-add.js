/*
  Quick add script

  This file loads product-specific quick add markup and presents it in the shared modal.
*/

class QuickAdd extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.dialogHost = this.querySelector("theme-dialog");
    this.content = this.querySelector("[data-quick-add-content]");

    if (!this.dialogHost || !this.content) return;

    this.cache = new Map();
    this.listenerController = new AbortController();
    document.addEventListener("click", this.onDocumentClick.bind(this), {
      signal: this.listenerController.signal,
    });
    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.requestController?.abort();
    this.isInitialized = false;
  }

  async onDocumentClick(event) {
    const trigger = event.target.closest("[data-quick-add-url]");

    if (!trigger) return;

    event.preventDefault();
    await this.load(trigger, event.detail !== 0);
  }

  async load(trigger, openedByPointer) {
    const productUrl = trigger.dataset.quickAddUrl;

    if (!productUrl) return;

    this.requestController?.abort();
    this.setTriggerLoading(trigger, true);
    this.content.innerHTML = `<p role="status">${this.escapeHtml(this.content.dataset.loadingText)}</p>`;

    try {
      const html = await this.fetchSection(productUrl);

      this.content.innerHTML = html;
      this.dialogHost.setReturnFocus(trigger);
      this.dialogHost.openedByPointer = openedByPointer;
      this.dialogHost.openDialog();
    } catch (error) {
      if (error.name === "AbortError") return;

      this.content.innerHTML = `<p class="alert alert-with-icon alert-error">${this.escapeHtml(
        this.content.dataset.unavailableText,
      )}</p>`;
      this.dialogHost.setReturnFocus(trigger);
      this.dialogHost.openedByPointer = openedByPointer;
      this.dialogHost.openDialog();
    } finally {
      this.setTriggerLoading(trigger, false);
    }
  }

  async fetchSection(productUrl) {
    const url = new URL(productUrl, window.location.origin);

    url.searchParams.set("section_id", "quick-add");

    if (this.cache.has(url.href)) return this.cache.get(url.href);

    this.requestController = new AbortController();
    const response = await fetch(url, { signal: this.requestController.signal });

    if (!response.ok) throw new Error(`Quick add request failed with status ${response.status}`);

    const html = await response.text();

    if (!html.includes("data-quick-add-product")) throw new Error("Quick add product markup was not returned");

    this.cache.set(url.href, html);
    return html;
  }

  setTriggerLoading(trigger, isLoading) {
    trigger.classList.toggle("loading", isLoading);
    trigger.toggleAttribute("aria-busy", isLoading);
    trigger.disabled = isLoading;
  }

  escapeHtml(value) {
    const element = document.createElement("span");

    element.textContent = value || "";
    return element.innerHTML;
  }
}

if (!customElements.get("quick-add")) {
  customElements.define("quick-add", QuickAdd);
}
