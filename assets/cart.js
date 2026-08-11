/*
  Cart script

  This file owns cart feedback, badges, line mutations, standard event synchronization, and shared rendering.
*/

class CartFeedback extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.listenerController = new AbortController();
    document.addEventListener("shopify:cart:lines-update", this.onCartLinesUpdate.bind(this), {
      signal: this.listenerController.signal,
    });
    document.addEventListener("theme:cart:render-error", this.onCartRenderError.bind(this), {
      signal: this.listenerController.signal,
    });
    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.isInitialized = false;
  }

  async onCartLinesUpdate(event) {
    try {
      const result = await event.promise;
      const errorMessages = (result.userErrors || []).map(({ message }) => message).filter(Boolean);
      const warningMessages = (result.warnings || []).map(({ message }) => message).filter(Boolean);

      if (errorMessages.length) {
        this.show([...errorMessages, ...warningMessages].join(" "), "error");
        return;
      }

      if (warningMessages.length) {
        this.show(warningMessages.join(" "), "warning");
        return;
      }

      if (!result.cart) return;

      const announcementType =
        {
          add: "added",
          remove: "removed",
          update: "updated",
        }[event.action] || "updated";

      if (document.documentElement.dataset.cartType === "page" && announcementType === "added") {
        this.show(this.dataset.cartAddedText, "success");
        return;
      }

      this.announce(announcementType);
    } catch {
      this.show(this.dataset.cartErrorText, "error");
    }
  }

  onCartRenderError() {
    this.show(this.dataset.cartErrorText, "error");
  }

  show(message, type) {
    document.querySelector("theme-toast")?.show(message, type);
  }

  announce(type) {
    const announcement = {
      added: this.dataset.cartAddedText,
      removed: this.dataset.cartRemovedText,
      updated: this.dataset.cartUpdatedText,
    }[type];

    document.querySelector("theme-toast")?.announce(announcement);
  }
}

if (!customElements.get("cart-feedback")) {
  customElements.define("cart-feedback", CartFeedback);
}

class CartBadge extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.listenerController = new AbortController();
    document.addEventListener("shopify:cart:lines-update", this.onCartLinesUpdate.bind(this), {
      signal: this.listenerController.signal,
    });
    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.isInitialized = false;
  }

  async onCartLinesUpdate(event) {
    const result = await event.promise.catch(() => null);
    const itemCount = result?.cart?.totalQuantity;

    if (!Number.isFinite(itemCount)) return;

    this.dataset.itemCount = itemCount;
    this.textContent = itemCount;
  }
}

if (!customElements.get("cart-badge")) {
  customElements.define("cart-badge", CartBadge);
}

class CartItems extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.listenerController = new AbortController();
    this.addEventListener("click", this.onRemoveClick.bind(this), {
      signal: this.listenerController.signal,
    });
    this.addEventListener("change", this.onQuantityChange.bind(this), {
      signal: this.listenerController.signal,
    });
    document.addEventListener("shopify:cart:lines-update", this.onCartLinesUpdate.bind(this), {
      signal: this.listenerController.signal,
    });
    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.isInitialized = false;
  }

  async onRemoveClick(event) {
    const removeButton = event.target.closest("[data-cart-line-remove]");
    const lineId = removeButton?.dataset.cartLineId;

    if (!lineId || !window.Shopify?.actions?.updateCart || this.getAttribute("aria-busy") === "true") return;

    try {
      await window.Shopify.actions.updateCart(
        { lines: [{ id: lineId, quantity: 0 }] },
        {
          event: {
            context: this.dataset.context === "drawer" ? "dialog" : "cart",
            detail: { source: "cart-remove" },
          },
        },
      );
    } catch (error) {
      console.error("[Cart] Line remove failed", error);
    }
  }

  async onQuantityChange(event) {
    const quantityInput = event.target.closest("[data-cart-line-quantity]");
    const lineId = quantityInput?.dataset.cartLineId;
    const quantity = Number.parseInt(quantityInput?.value, 10);

    if (
      !lineId ||
      !Number.isFinite(quantity) ||
      quantity < 0 ||
      !window.Shopify?.actions?.updateCart ||
      this.getAttribute("aria-busy") === "true"
    ) {
      return;
    }

    this.pendingFocusId = quantityInput.dataset.cartFocusId;
    try {
      await window.Shopify.actions.updateCart(
        { lines: [{ id: lineId, quantity }] },
        {
          event: {
            context: this.dataset.context === "drawer" ? "dialog" : "cart",
            detail: { source: "cart-quantity" },
          },
        },
      );
    } catch (error) {
      console.error("[Cart] Line quantity update failed", error);
    }
  }

  async onCartLinesUpdate(event) {
    this.setAttribute("aria-busy", "true");

    try {
      let result;

      try {
        result = await event.promise;
      } catch (error) {
        console.error("[Cart] Cart update failed", error);
        return;
      }

      const { cart, userErrors = [], warnings = [] } = result;
      const hasIssues = userErrors.length > 0 || warnings.length > 0;

      if (!cart) return;

      try {
        if (this.dataset.context === "drawer" && !hasIssues) {
          await window.Shopify.actions.openCart();
        }

        await this.render();
      } catch (error) {
        console.error("[Cart] Cart rendering failed", error);

        document.dispatchEvent(new CustomEvent("theme:cart:render-error"));
      }
    } finally {
      this.removeAttribute("aria-busy");
    }
  }

  async render() {
    const url = new URL(window.location.href);

    url.searchParams.set("sections", "cart-items-render,cart-summary-render");

    const response = await fetch(url.toString(), {
      headers: { Accept: "text/html" },
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`Unable to refresh cart: ${response.status}`);

    const sections = await response.json();
    const cartItemsHtml = sections["cart-items-render"];
    const cartSummaryHtml = sections["cart-summary-render"];

    if (!cartItemsHtml) throw new Error("Rendered cart items were not found");
    if (!cartSummaryHtml) throw new Error("Rendered cart summary was not found");

    const parser = new DOMParser();
    const cartItemsDocument = parser.parseFromString(cartItemsHtml, "text/html");
    const cartSummaryDocument = parser.parseFromString(cartSummaryHtml, "text/html");
    const nextCartItems = cartItemsDocument.querySelector("cart-items");
    const nextCartSummary = cartSummaryDocument.querySelector("[data-cart-summary]");
    const currentCartSummary = document.querySelector(
      `[data-cart-summary][data-context="${CSS.escape(this.dataset.context)}"]`,
    );

    if (!nextCartItems || !nextCartSummary || !currentCartSummary) {
      throw new Error("Rendered cart content was not found");
    }

    const renderedId = nextCartItems.id;

    nextCartItems.id = this.id;
    nextCartItems.dataset.context = this.dataset.context;
    nextCartItems.querySelectorAll("[id]").forEach((element) => {
      element.id = element.id.replace(renderedId, this.id);
    });

    nextCartSummary.id = currentCartSummary.id;
    nextCartSummary.className = currentCartSummary.className;
    nextCartSummary.dataset.context = this.dataset.context;

    const focusId = this.pendingFocusId;

    currentCartSummary.replaceWith(nextCartSummary);
    this.replaceWith(nextCartItems);

    if (focusId) {
      nextCartItems.querySelector(`[data-cart-focus-id="${CSS.escape(focusId)}"]`)?.focus();
    }
  }
}

if (!customElements.get("cart-items")) {
  customElements.define("cart-items", CartItems);
}
