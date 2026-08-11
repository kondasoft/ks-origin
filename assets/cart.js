/*
  Cart script

  This file owns cart feedback, badges, line mutations, standard event synchronization, and shared rendering.
*/

class CartFeedback extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.drawerAlert = document.querySelector("[data-cart-drawer-alert]");
    this.drawerAlertMessage = this.drawerAlert?.querySelector("[data-cart-drawer-alert-message]");
    this.cartDialog = document.getElementById("cart-dialog");
    this.listenerController = new AbortController();
    document.addEventListener("shopify:cart:lines-update", this.onCartLinesUpdate.bind(this), {
      signal: this.listenerController.signal,
    });
    document.addEventListener("shopify:cart:note-update", this.onCartNoteUpdate.bind(this), {
      signal: this.listenerController.signal,
    });
    document.addEventListener("shopify:cart:discount-update", this.onCartDiscountUpdate.bind(this), {
      signal: this.listenerController.signal,
    });
    document.addEventListener("shopify:cart:error", this.onCartError.bind(this), {
      signal: this.listenerController.signal,
    });
    document.addEventListener("theme:cart:render-error", this.onCartRenderError.bind(this), {
      signal: this.listenerController.signal,
    });
    this.cartDialog?.addEventListener("close", this.hideDrawerAlert.bind(this), {
      signal: this.listenerController.signal,
    });
    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    window.clearTimeout(this.drawerAlertTimer);
    cancelAnimationFrame(this.drawerAlertFrame);
    this.isInitialized = false;
  }

  async onCartLinesUpdate(event) {
    try {
      const result = await event.promise;

      if (this.showResultIssues(result)) return;

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
      return;
    }
  }

  async onCartNoteUpdate(event) {
    try {
      const result = await event.promise;

      if (this.showResultIssues(result)) return;
      if (!result.cart) return;

      this.show(this.dataset.cartNoteUpdatedText, "success");
    } catch {
      return;
    }
  }

  async onCartDiscountUpdate(event) {
    try {
      const result = await event.promise;

      if (event.detail?.source === "cart-discount-cleanup") return;
      if (this.showResultIssues(result)) return;
      if (!result.cart) return;

      const hasInvalidCode = result.cart.discountCodes.some(({ applicable }) => !applicable);

      if (hasInvalidCode) {
        this.show(this.dataset.cartDiscountInvalidText, "warning");
        return;
      }

      this.show(this.dataset.cartDiscountUpdatedText, "success");
    } catch {
      return;
    }
  }

  onCartError(event) {
    const message = typeof event.error === "string" && event.error ? event.error : this.dataset.cartErrorText;

    this.show(message, "error");
  }

  onCartRenderError() {
    this.show(this.dataset.cartErrorText, "error");
  }

  show(message, type) {
    if (this.cartDialog?.open && this.drawerAlert && this.drawerAlertMessage) {
      this.showDrawerAlert(message, type);
      return;
    }

    document.querySelector("theme-toast")?.show(message, type);
  }

  showDrawerAlert(message, type) {
    window.clearTimeout(this.drawerAlertTimer);
    cancelAnimationFrame(this.drawerAlertFrame);

    this.drawerAlert.classList.remove("alert-error", "alert-warning", "alert-success");
    this.drawerAlert.classList.add(`alert-${type}`);
    this.drawerAlertMessage.textContent = "";
    this.drawerAlert.hidden = false;
    document.querySelector("theme-toast")?.announce(message, type === "error" ? "alert" : "status");

    this.drawerAlertFrame = requestAnimationFrame(() => {
      this.drawerAlertMessage.textContent = message;
      this.drawerAlertTimer = window.setTimeout(() => this.hideDrawerAlert(), 6000);
    });
  }

  hideDrawerAlert() {
    window.clearTimeout(this.drawerAlertTimer);
    cancelAnimationFrame(this.drawerAlertFrame);

    if (!this.drawerAlert || !this.drawerAlertMessage) return;

    this.drawerAlert.hidden = true;
    this.drawerAlertMessage.textContent = "";
  }

  showResultIssues(result) {
    const errorMessages = (result.userErrors || []).map(({ message }) => message).filter(Boolean);
    const warningMessages = (result.warnings || []).map(({ message }) => message).filter(Boolean);

    if (errorMessages.length) {
      this.show([...errorMessages, ...warningMessages].join(" "), "error");
      return true;
    }

    if (warningMessages.length) {
      this.show(warningMessages.join(" "), "warning");
      return true;
    }

    return false;
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

class CartNote extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.form = this.querySelector("form");
    this.input = this.form?.querySelector('[name="note"]');
    this.submitButton = this.form?.querySelector('[type="submit"]');

    if (!this.form || !this.input || !this.submitButton) return;

    this.listenerController = new AbortController();
    this.form.addEventListener("submit", this.onSubmit.bind(this), {
      signal: this.listenerController.signal,
    });
    document.addEventListener("shopify:cart:note-update", this.onCartNoteUpdate.bind(this), {
      signal: this.listenerController.signal,
    });
    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.isInitialized = false;
  }

  async onSubmit(event) {
    if (!window.Shopify?.actions?.updateCart) return;

    event.preventDefault();

    if (this.form.getAttribute("aria-busy") === "true") return;

    const note = new FormData(this.form).get("note");

    this.form.setAttribute("aria-busy", "true");
    this.submitButton.setAttribute("aria-disabled", "true");
    this.submitButton.classList.add("loading");

    try {
      await window.Shopify.actions.updateCart(
        { note: typeof note === "string" ? note : "" },
        {
          event: {
            context: this.dataset.context === "drawer" ? "dialog" : "cart",
            detail: { source: "cart-note" },
          },
        },
      );
    } catch (error) {
      console.error("[Cart] Note update failed", error);
    } finally {
      this.form.removeAttribute("aria-busy");
      this.submitButton.removeAttribute("aria-disabled");
      this.submitButton.classList.remove("loading");
    }
  }

  async onCartNoteUpdate(event) {
    const result = await event.promise.catch(() => null);

    if (!result?.cart || result.userErrors?.length) return;

    this.input.value = typeof event.note === "string" ? event.note : "";
  }
}

if (!customElements.get("cart-note")) {
  customElements.define("cart-note", CartNote);
}

class CartDiscount extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.form = this.querySelector("form");
    this.input = this.querySelector("[data-cart-discount-input]");
    this.submitButton = this.form?.querySelector('[type="submit"]');
    this.codeList = this.querySelector("[data-cart-discount-codes]");
    this.codeTemplate = this.querySelector("[data-cart-discount-code-template]");

    if (!this.form || !this.input || !this.submitButton || !this.codeList || !this.codeTemplate) return;

    this.listenerController = new AbortController();
    this.form.addEventListener("submit", this.onSubmit.bind(this), {
      signal: this.listenerController.signal,
    });
    this.addEventListener("click", this.onRemoveClick.bind(this), {
      signal: this.listenerController.signal,
    });
    document.addEventListener("shopify:cart:discount-update", this.onCartDiscountUpdate.bind(this), {
      signal: this.listenerController.signal,
    });
    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.isInitialized = false;
  }

  async onSubmit(event) {
    if (!window.Shopify?.actions?.updateCart) return;

    event.preventDefault();

    const code = this.input.value.trim();
    const existingCodes = this.getExistingCodes();
    const isDuplicate = existingCodes.some((existingCode) => existingCode.toLowerCase() === code.toLowerCase());

    if (!code || isDuplicate || this.getAttribute("aria-busy") === "true") return;

    await this.updateDiscountCodes([...existingCodes, code], code, this.submitButton);
  }

  async onRemoveClick(event) {
    const removeButton = event.target.closest("[data-cart-discount-remove]");
    const code = removeButton?.closest("[data-cart-discount-code]")?.dataset.cartDiscountCode;

    if (!removeButton || !code || this.getAttribute("aria-busy") === "true") return;

    const nextCodes = this.getExistingCodes().filter(
      (existingCode) => existingCode.toLowerCase() !== code.toLowerCase(),
    );

    await this.updateDiscountCodes(nextCodes, "", removeButton);
  }

  async onCartDiscountUpdate(event) {
    const result = await event.promise.catch(() => null);
    const discountCodes = result?.cart?.discountCodes;

    if (!Array.isArray(discountCodes)) return;

    this.renderCodes(discountCodes.filter(({ applicable }) => applicable).map(({ code }) => code));
  }

  async updateDiscountCodes(discountCodes, submittedCode, trigger) {
    this.setAttribute("aria-busy", "true");
    trigger.setAttribute("aria-disabled", "true");
    if (trigger.matches(".btn")) trigger.classList.add("loading");

    try {
      const result = await window.Shopify.actions.updateCart(
        { discountCodes },
        {
          event: {
            context: this.dataset.context === "drawer" ? "dialog" : "cart",
            detail: { source: "cart-discount" },
          },
        },
      );
      const codeWasApplied = result.cart?.discountCodes?.some(
        ({ applicable, code }) => applicable && code.toLowerCase() === submittedCode.toLowerCase(),
      );
      const applicableCodes = result.cart?.discountCodes
        ?.filter(({ applicable }) => applicable)
        .map(({ code }) => code);
      const hasInvalidCodes = result.cart?.discountCodes?.some(({ applicable }) => !applicable);

      if (hasInvalidCodes) await this.clearInvalidDiscountCodes(applicableCodes || []);

      if (submittedCode && (codeWasApplied || hasInvalidCodes)) this.input.value = "";
    } catch (error) {
      console.error("[Cart] Discount update failed", error);
    } finally {
      this.removeAttribute("aria-busy");
      trigger.removeAttribute("aria-disabled");
      trigger.classList.remove("loading");
    }
  }

  async clearInvalidDiscountCodes(discountCodes) {
    await window.Shopify.actions.updateCart(
      { discountCodes },
      {
        event: {
          context: this.dataset.context === "drawer" ? "dialog" : "cart",
          detail: { source: "cart-discount-cleanup" },
        },
      },
    );
  }

  getExistingCodes() {
    return Array.from(this.querySelectorAll("[data-cart-discount-code]"), (item) => item.dataset.cartDiscountCode)
      .filter(Boolean);
  }

  renderCodes(discountCodes) {
    this.codeList.replaceChildren();
    this.codeList.hidden = discountCodes.length === 0;

    discountCodes.forEach((code) => {
      const codeFragment = this.codeTemplate.content.cloneNode(true);
      const codeItem = codeFragment.querySelector("[data-cart-discount-code]");
      const codeText = codeFragment.querySelector("[data-cart-discount-code-text]");
      const removeButton = codeFragment.querySelector("[data-cart-discount-remove]");

      if (!codeItem || !codeText || !removeButton) return;

      codeItem.dataset.cartDiscountCode = code;
      codeText.textContent = code;
      removeButton.setAttribute("aria-label", this.dataset.removeLabel.replace("[code]", code));
      this.codeList.append(codeFragment);
    });
  }
}

if (!customElements.get("cart-discount")) {
  customElements.define("cart-discount", CartDiscount);
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

function updateCartDrawerViewPayload(cart) {
  const cartViewEvent = document.querySelector("[data-cart-view-event]");

  if (!cartViewEvent) return;

  cartViewEvent.setAttribute("view-event-payload", JSON.stringify({ context: "dialog", cart }));
}

let cartRenderGeneration = 0;

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
    document.addEventListener("shopify:cart:discount-update", this.onCartDiscountUpdate.bind(this), {
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

      updateCartDrawerViewPayload(cart);

      const cartOptions = document.querySelector(
        `[data-cart-options][data-context="${CSS.escape(this.dataset.context)}"]`,
      );
      const cartHeading = document.querySelector("[data-cart-heading]");

      if (cartOptions) cartOptions.hidden = cart.totalQuantity === 0;
      if (cartHeading) cartHeading.classList.toggle("visually-hidden", cart.totalQuantity === 0);

      try {
        if (this.dataset.context === "drawer" && event.action === "add" && !hasIssues) {
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

  async onCartDiscountUpdate(event) {
    this.setAttribute("aria-busy", "true");

    try {
      let result;

      try {
        result = await event.promise;

        if (!result.cart) return;
      } catch (error) {
        console.error("[Cart] Discount update failed", error);
        return;
      }

      updateCartDrawerViewPayload(result.cart);

      try {
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
    const renderGeneration = ++cartRenderGeneration;
    const url = new URL(window.location.href);

    url.searchParams.set("sections", "cart-items-render,cart-summary-render");

    const response = await fetch(url.toString(), {
      headers: { Accept: "text/html" },
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`Unable to refresh cart: ${response.status}`);

    const sections = await response.json();

    if (renderGeneration !== cartRenderGeneration) return;

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
