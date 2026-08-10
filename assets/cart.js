/*
  Cart script

  This file owns product-form and cart-line mutations, standard cart-event synchronization, and shared cart rendering.
*/

class CartController {
  constructor() {
    document.addEventListener("submit", this.onProductFormSubmit.bind(this));
  }

  async onProductFormSubmit(event) {
    const form = event.target.closest('form[action*="/cart/add"]');
    const submitButton = event.submitter || form?.querySelector('[type="submit"][name="add"]');

    if (!form || submitButton?.name !== "add" || !window.Shopify?.actions?.updateCart) return;

    if (form.getAttribute("aria-busy") === "true") {
      event.preventDefault();
      return;
    }

    const line = this.createCartLine(new FormData(form));

    if (!line) return;

    event.preventDefault();
    form.setAttribute("aria-busy", "true");
    submitButton.setAttribute("aria-busy", "true");
    submitButton.setAttribute("aria-disabled", "true");
    submitButton.classList.add("loading");
    submitButton.focus({ preventScroll: true });

    try {
      const result = await window.Shopify.actions.updateCart(
        { lines: [line] },
        {
          event: {
            context: "product",
            detail: { source: form.dataset.cartSource || "product-form" },
          },
        },
      );

      if (document.documentElement.dataset.cartType === "page") {
        this.handlePageCartResult(result);
      }
    } catch (error) {
      console.error("[Cart] Product add failed", error);

      if (document.documentElement.dataset.cartType === "page") {
        this.showToast(document.documentElement.dataset.cartErrorText, "error");
      }
    } finally {
      form.removeAttribute("aria-busy");
      submitButton.removeAttribute("aria-busy");
      submitButton.removeAttribute("aria-disabled");
      submitButton.classList.remove("loading");
    }
  }

  createCartLine(formData) {
    const merchandiseId = formData.get("id");

    if (!merchandiseId) return null;

    const quantity = Math.max(1, Number.parseInt(formData.get("quantity"), 10) || 1);
    const sellingPlanId = formData.get("selling_plan");
    const attributes = [];

    formData.forEach((value, key) => {
      const property = key.match(/^properties\[(.+)]$/)?.[1];

      if (property && typeof value === "string" && value !== "") {
        attributes.push({ key: property, value });
      }
    });

    return {
      merchandiseId: String(merchandiseId),
      quantity,
      ...(sellingPlanId ? { sellingPlanId: String(sellingPlanId) } : {}),
      ...(attributes.length ? { attributes } : {}),
    };
  }

  handlePageCartResult(result) {
    const errorMessages = (result.userErrors || []).map(({ message }) => message).filter(Boolean);
    const warningMessages = (result.warnings || []).map(({ message }) => message).filter(Boolean);
    const messages = [...errorMessages, ...warningMessages];

    if (messages.length) {
      this.showToast(messages.join(" "), errorMessages.length ? "error" : "warning");
    } else {
      const addedMessage = document.querySelector("[data-cart-live-region]")?.dataset.cartAddedText;

      this.showToast(addedMessage, "success");
    }
  }

  showToast(message, type) {
    document.querySelector("theme-toast")?.show(message, type);
  }
}

new CartController();

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
    this.addEventListener("shopify:cart:lines-update", this.onCartLinesUpdate.bind(this), {
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

    this.pendingAnnouncement = "removed";

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
    this.pendingAnnouncement = quantity === 0 ? "removed" : "updated";

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
      const result = await event.promise;

      console.log("[Cart] Cart update completed", result);

      const { cart, userErrors = [], warnings = [] } = result;
      const errorMessages = userErrors.map(({ message }) => message).filter(Boolean);
      const warningMessages = warnings.map(({ message }) => message).filter(Boolean);
      const messages = [...errorMessages, ...warningMessages];
      const messageType = errorMessages.length ? "error" : warningMessages.length ? "warning" : "";
      const announcementType =
        event.action === "add" || event.context === "product" ? "added" : this.pendingAnnouncement || "updated";

      if (!cart && !messages.length) return;

      if (this.dataset.context === "drawer") {
        await window.Shopify.actions.openCart();
      }

      await this.render(messages, messageType);

      if (cart && !messages.length) this.announceCartUpdate(announcementType);
    } catch (error) {
      console.error("[Cart] Cart update failed", error);

      if (this.dataset.context === "drawer") {
        await window.Shopify.actions.openCart();
      }

      const currentCartItems =
        document.querySelector(`cart-items[data-context="${CSS.escape(this.dataset.context)}"]`) || this;

      this.showMessage([document.documentElement.dataset.cartErrorText], "error", currentCartItems)?.focus();
    } finally {
      this.pendingAnnouncement = "";
      this.removeAttribute("aria-busy");
    }
  }

  async render(messages = [], messageType = "") {
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

    const cartMessage = this.showMessage(messages, messageType, nextCartItems);

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

    if (messages.length && cartMessage) {
      cartMessage.focus();
    } else if (focusId) {
      nextCartItems.querySelector(`[data-cart-focus-id="${CSS.escape(focusId)}"]`)?.focus();
    }
  }

  announceCartUpdate(type) {
    const liveRegion = document.querySelector("[data-cart-live-region]");
    const announcement = {
      added: liveRegion?.dataset.cartAddedText,
      removed: liveRegion?.dataset.cartRemovedText,
      updated: liveRegion?.dataset.cartUpdatedText,
    }[type];

    if (!liveRegion || !announcement) return;

    liveRegion.textContent = "";
    requestAnimationFrame(() => {
      liveRegion.textContent = announcement;
    });
  }

  showMessage(messages, type, cartItems = this) {
    const cartMessage = cartItems.querySelector("[data-cart-message]");

    if (!cartMessage || !messages.length) return null;

    cartMessage.textContent = messages.join(" ");
    cartMessage.classList.remove("alert-error", "alert-warning");
    cartMessage.classList.add(`alert-${type}`);
    cartMessage.setAttribute("role", type === "error" ? "alert" : "status");
    cartMessage.tabIndex = -1;
    cartMessage.hidden = false;

    return cartMessage;
  }
}

if (!customElements.get("cart-items")) {
  customElements.define("cart-items", CartItems);
}
