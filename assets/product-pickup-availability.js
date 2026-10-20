/*
  Product pickup availability script

  This file owns variant pickup requests and replacement markup. Product selection belongs to the variant picker,
  and opening, closing and focus management belong to ThemeDialog.
*/

class ProductPickupAvailability extends HTMLElement {
  connectedCallback() {
    this.content = this.querySelector("[data-pickup-availability-content]");

    if (this.pendingVariant !== undefined) this.updateVariant(this.pendingVariant);
  }

  disconnectedCallback() {
    this.fetchController?.abort();
    this.removeAttribute("aria-busy");
  }

  updateVariant(variant) {
    this.pendingVariant = variant;
    this.fetchController?.abort();
    this.removeAttribute("aria-busy");
    this.dataset.variantId = variant?.id || "";
    this.querySelector("dialog[open]")?.close();
    this.content.inert = false;

    if (!variant?.available || !this.isConnected) {
      this.hidden = true;
      return;
    }

    // Hiding during the request would shift the content below on every variant change, so the previous
    // variant's row stays in place but can't be used until the response replaces it.
    this.content.inert = true;
    this.refresh(variant.id);
  }

  async refresh(variantId) {
    const controller = new AbortController();

    this.fetchController = controller;
    const rootUrl = this.dataset.rootUrl.replace(/\/?$/, "/");
    const url = `${rootUrl}variants/${variantId}/?section_id=pickup-availability`;

    this.setAttribute("aria-busy", "true");

    try {
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) throw new Error(`Pickup availability request failed: ${response.status}`);

      const html = new DOMParser().parseFromString(await response.text(), "text/html");
      const nextContent = html.querySelector("[data-pickup-availability-content]");

      if (controller.signal.aborted || !this.isConnected || this.fetchController !== controller) return;

      const dialog = nextContent?.querySelector("dialog");

      if (!dialog) {
        this.hidden = true;
        this.content.replaceChildren();
        return;
      }

      // Render-only requests have no block context. Remap IDs before ThemeDialog connects and binds its trigger.
      const dialogId = this.dataset.dialogId;
      const heading = nextContent.querySelector(".dialog-title");
      const trigger = nextContent.querySelector("[data-toggle]");

      dialog.id = dialogId;
      heading.id = `${dialogId}-title`;
      dialog.setAttribute("aria-labelledby", heading.id);
      trigger.dataset.toggle = dialogId;
      this.content.replaceChildren(...nextContent.childNodes);
      this.hidden = false;
    } catch (error) {
      if (controller.signal.aborted || this.fetchController !== controller) return;

      this.hidden = true;
      this.content.replaceChildren();
      console.error("[Pickup availability] Refresh failed", error);
    } finally {
      // An aborted older request must not clear the newer request's busy state.
      if (this.fetchController === controller) {
        this.removeAttribute("aria-busy");
        this.content.inert = false;
      }
    }
  }
}

if (!customElements.get("product-pickup-availability")) {
  customElements.define("product-pickup-availability", ProductPickupAvailability);
}
