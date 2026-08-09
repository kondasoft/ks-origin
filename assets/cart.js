/*
  Cart script

  This file owns product-form and cart-line mutations, standard cart-event synchronization, and shared cart rendering.
  Keep cart markup and presentation in the shared cart snippet and stylesheet.
*/

class CartItems extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.listenerController = new AbortController();
    const listenerOptions = { signal: this.listenerController.signal };

    this.addEventListener("change", this.onQuantityChange.bind(this), listenerOptions);
    this.addEventListener("click", this.onRemoveClick.bind(this), listenerOptions);
    this.addEventListener("shopify:cart:lines-update", this.onCartUpdate.bind(this), listenerOptions);
    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.isInitialized = false;
  }

  onQuantityChange(event) {
    const input = event.target.closest("[data-cart-line-quantity]");

    if (!input || !this.contains(input)) return;

    const quantity = Math.max(0, Number.parseInt(input.value, 10) || 0);

    input.value = String(quantity);
    this.updateLine(input.dataset.cartLineId, quantity, input.dataset.cartFocusId, input);
  }

  onRemoveClick(event) {
    const button = event.target.closest("[data-cart-line-remove]");

    if (!button || !this.contains(button)) return;

    this.updateLine(button.dataset.cartLineId, 0);
  }

  onCartUpdate(event) {
    if (event.action !== "add" || !event.promise?.then) return;

    this.setAttribute("aria-busy", "true");

    event.promise
      .then(({ cart, userErrors }) => {
        if (userErrors?.length || !cart) this.removeAttribute("aria-busy");
      })
      .catch(() => this.removeAttribute("aria-busy"));
  }

  async updateLine(id, quantity, focusId = "", quantityInput = null) {
    if (!id || !window.Shopify?.actions?.updateCart || this.hasAttribute("aria-busy")) return;

    this.setAttribute("aria-busy", "true");
    this.showMessage();
    let refreshExpected = false;

    try {
      const { cart, userErrors } = await window.Shopify.actions.updateCart(
        { lines: [{ id, quantity }] },
        {
          event: {
            context: this.dataset.context === "drawer" ? "dialog" : "cart",
            detail: { source: "cart-items", sourceId: this.id, focusId },
          },
        },
      );

      if (userErrors?.length) {
        if (quantityInput) quantityInput.value = quantityInput.defaultValue;
        this.showMessage(userErrors[0].message, "error");
      } else if (cart) {
        refreshExpected = true;
      } else {
        if (quantityInput) quantityInput.value = quantityInput.defaultValue;
        this.showMessage(this.dataset.cartErrorText, "error");
      }
    } catch {
      if (quantityInput) quantityInput.value = quantityInput.defaultValue;
      this.showMessage(this.dataset.cartErrorText, "error");
    } finally {
      if (!refreshExpected) this.removeAttribute("aria-busy");
    }
  }

  showMessage(message = "", type = "") {
    const messageElement = this.querySelector("[data-cart-message]");

    if (!messageElement) return;

    messageElement.textContent = message;
    messageElement.classList.toggle("alert-error", type === "error");
    messageElement.classList.toggle("alert-warning", type === "warning");
    messageElement.hidden = !message;
  }
}

if (!customElements.get("cart-items")) {
  customElements.define("cart-items", CartItems);
}

class CartController {
  constructor() {
    document.addEventListener("submit", this.onProductFormSubmit.bind(this));
    document.addEventListener("shopify:cart:lines-update", this.onCartLinesUpdate.bind(this));
    this.restoreCartMessage();
  }

  async onProductFormSubmit(event) {
    const form = event.target.closest("form.product-main-buy-buttons-form, form.product-card-form");

    if (!form || !window.Shopify?.actions?.updateCart) return;

    const line = this.createCartLine(new FormData(form));

    if (!line) return;

    event.preventDefault();

    const submitButton = event.submitter || form.querySelector('[type="submit"]');
    const wasDisabled = submitButton?.disabled;
    let cartOpened = false;

    this.setCartReturnFocus(submitButton);
    this.setFormLoading(form, submitButton, true);
    this.showCartMessage();

    try {
      console.log("[Cart] Adding product", line);

      const { cart, userErrors, warnings } = await window.Shopify.actions.updateCart(
        { lines: [line] },
        { event: { context: "product", detail: { source: "product-form" } } },
      );

      console.log("[Cart] Product add completed", { cart, userErrors, warnings });

      if (userErrors?.length) {
        this.setCartItemsLoading(false);
        await this.presentCartMessage(userErrors[0].message, "error");
        return;
      }

      if (!cart) throw new Error("Cart data was not returned");

      const hasCartItems = Boolean(document.querySelector("cart-items[id]"));

      if (!hasCartItems && warnings?.length) this.storeCartMessage(warnings[0].message, "warning");

      this.updateCartBadges(cart.totalQuantity);

      const openCartPromise = window.Shopify.actions.openCart();

      cartOpened = true;
      await openCartPromise;

      if (!hasCartItems) return;

      await this.refreshCartItems("", "", warnings?.[0]?.message, warnings?.length ? "warning" : "");
    } catch (error) {
      console.error("[Cart] Product add failed", error);

      this.setCartItemsLoading(false);

      if (cartOpened) {
        this.showCartMessage(document.documentElement.dataset.cartErrorText, "error");
      } else {
        await this.presentCartMessage(document.documentElement.dataset.cartErrorText, "error");
      }
    } finally {
      this.setFormLoading(form, submitButton, false, wasDisabled);
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

  onCartLinesUpdate(event) {
    if (!event.promise?.then) return;

    const sourceId = event.detail?.sourceId || event.target?.closest?.("cart-items")?.id;
    const isProductFormUpdate = event.action === "add" && event.context === "product";

    event.promise
      .then(async ({ cart, userErrors, warnings }) => {
        if (userErrors?.length || !cart) return;

        if (isProductFormUpdate) return;

        this.updateCartBadges(cart.totalQuantity);

        await this.refreshCartItems(
          event.detail?.focusId,
          sourceId,
          warnings?.[0]?.message,
          warnings?.length ? "warning" : "",
        );
      })
      .catch((error) => {
        if (error?.name === "AbortError") return;

        console.error("[Cart] Cart update failed", error);
        this.showCartRefreshError(sourceId);
      });
  }

  showCartRefreshError(sourceId) {
    const sourceItems = sourceId ? document.getElementById(sourceId) : null;

    if (!sourceItems) return;

    sourceItems.removeAttribute("aria-busy");
    sourceItems.showMessage(sourceItems.dataset.cartErrorText, "error");
  }

  async refreshCartItems(focusId = "", sourceId = "", message = "", messageType = "") {
    if (this.cartRefreshPromise) return this.cartRefreshPromise;

    this.cartRefreshPromise = this.fetchCartItems(focusId, sourceId, message, messageType);

    try {
      await this.cartRefreshPromise;
    } finally {
      this.cartRefreshPromise = null;
    }
  }

  async fetchCartItems(focusId, sourceId, message, messageType) {
    const response = await fetch(`${window.location.pathname}?section_id=cart-items-render`, {
      headers: { Accept: "text/html" },
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`Unable to refresh cart: ${response.status}`);

    const sectionHtml = await response.text();

    if (!sectionHtml) throw new Error("Cart items section was not returned");

    const sectionDocument = new DOMParser().parseFromString(sectionHtml, "text/html");
    const renderedItems = sectionDocument.querySelector("cart-items");
    const refreshedItems = [];

    if (!renderedItems) throw new Error("Rendered cart items were not found");

    document.querySelectorAll("cart-items[id]").forEach((currentItems) => {
      const nextItems = this.cloneCartItems(renderedItems, currentItems);

      nextItems.setAttribute("aria-busy", "true");
      currentItems.replaceWith(nextItems);
      refreshedItems.push(nextItems);
    });

    if (!refreshedItems.length) throw new Error("Unable to find refreshed cart items");
    if (message) this.showCartMessage(message, messageType, sourceId);

    refreshedItems[0].getBoundingClientRect();
    refreshedItems.forEach((cartItems) => cartItems.removeAttribute("aria-busy"));

    if (focusId) {
      const sourceItems = sourceId ? document.getElementById(sourceId) : document;

      sourceItems?.querySelector(`[data-cart-focus-id="${CSS.escape(focusId)}"]`)?.focus();
    }

    const visibleItems =
      document.querySelector("#cart-dialog[open] cart-items") ||
      document.querySelector("main cart-items") ||
      refreshedItems[0];

    await Promise.all(visibleItems.getAnimations().map((animation) => animation.finished.catch(() => {})));
  }

  cloneCartItems(renderedItems, currentItems) {
    const nextItems = renderedItems.cloneNode(true);
    const renderedId = renderedItems.id;

    nextItems.id = currentItems.id;
    nextItems.dataset.context = currentItems.dataset.context;
    nextItems.querySelectorAll("[id]").forEach((element) => {
      element.id = element.id.replace(renderedId, currentItems.id);
    });

    return nextItems;
  }

  updateCartBadges(itemCount) {
    document.querySelectorAll("[data-cart-badge]").forEach((badge) => {
      badge.dataset.itemCount = itemCount;
      badge.textContent = itemCount;
    });
  } 

  setFormLoading(form, submitButton, isLoading, wasDisabled = false) {
    form.toggleAttribute("aria-busy", isLoading);

    if (!submitButton) return;

    submitButton.classList.toggle("btn-loading", isLoading);
    submitButton.toggleAttribute("aria-busy", isLoading);
    submitButton.disabled = isLoading || wasDisabled;
  }

  setCartItemsLoading(isLoading) {
    document.querySelectorAll("cart-items[id]").forEach((cartItems) => {
      cartItems.toggleAttribute("aria-busy", isLoading);
    });
  }

  setCartReturnFocus(element) {
    const cartDialog = document.getElementById("cart-dialog")?.closest("theme-dialog");

    cartDialog?.setReturnFocus(element);
  }

  async presentCartMessage(message, type) {
    if (!this.showCartMessage(message, type)) this.storeCartMessage(message, type);

    await window.Shopify.actions.openCart();
  }

  showCartMessage(message = "", type = "", sourceId = "") {
    const sourceItems = sourceId ? document.getElementById(sourceId) : null;
    const cartItems =
      sourceItems || document.querySelector("#cart-dialog cart-items") || document.querySelector("main cart-items");
    const messageElement = cartItems?.querySelector("[data-cart-message]");

    if (!messageElement) return false;

    this.updateMessage(messageElement, message, type);
    return true;
  }

  storeCartMessage(message, type) {
    try {
      sessionStorage.setItem("cart-message", JSON.stringify({ message, type }));
    } catch {
      // The cart still opens when browser storage is unavailable.
    }
  }

  restoreCartMessage() {
    let storedMessage;

    try {
      storedMessage = JSON.parse(sessionStorage.getItem("cart-message"));
      sessionStorage.removeItem("cart-message");
    } catch {
      return;
    }

    if (storedMessage?.message) this.showCartMessage(storedMessage.message, storedMessage.type);
  }

  updateMessage(messageElement, message, type) {
    messageElement.textContent = message;
    messageElement.classList.toggle("alert-error", type === "error");
    messageElement.classList.toggle("alert-warning", type === "warning");
    messageElement.hidden = !message;
  }
}

new CartController();
