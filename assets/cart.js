/*
  Cart script

  This file owns cart feedback, badges, line mutations, standard event synchronization, and shared rendering.
*/

class CartFeedback extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.drawerAlert = document.querySelector("[data-cart-drawer-alert]");
    this.drawerAlertMessage = this.drawerAlert?.querySelector("[data-cart-drawer-alert-message]");
    this.drawerAlertClose = this.drawerAlert?.querySelector("[data-cart-drawer-alert-close]");
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
    this.drawerAlertClose?.addEventListener("click", this.hideDrawerAlert.bind(this), {
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
    const toast = document.querySelector("theme-toast");

    toast?.syncDialog();

    if (
      this.cartDialog?.open &&
      (!toast || toast.closest("dialog") === this.cartDialog) &&
      this.drawerAlert &&
      this.drawerAlertMessage
    ) {
      this.showDrawerAlert(message, type);
      return;
    }

    toast?.show(message, type);
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

    this.interactedByPointer = false;
    this.quantityQueue = new Map();
    this.pendingUpdates = 0;
    this.lineRequestPending = false;
    this.listenerController = new AbortController();
    this.addEventListener("pointerdown", () => {
      this.interactedByPointer = true;
    }, { signal: this.listenerController.signal });
    this.addEventListener("keydown", () => {
      this.interactedByPointer = false;
    }, { signal: this.listenerController.signal });
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
    document.addEventListener("submit", this.onCheckoutSubmit.bind(this), {
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

    if (!lineId || !window.Shopify?.actions?.updateCart) return;

    this.setPendingFocus(removeButton, true);

    // Busy carts stay clickable for the quantity queue, so a removal waits there instead of being dropped.
    if (this.getAttribute("aria-busy") === "true") {
      this.quantityQueue.set(lineId, 0);
      this.syncBusyState();
      return;
    }

    await this.updateLines([{ id: lineId, quantity: 0 }], "cart-remove");
  }

  onQuantityChange(event) {
    const quantityInput = event.target.closest("[data-cart-line-quantity]");
    const lineId = quantityInput?.dataset.cartLineId;
    const quantity = Number.parseInt(quantityInput?.value, 10);

    if (
      !lineId ||
      !Number.isFinite(quantity) ||
      quantity < 0 ||
      !window.Shopify?.actions?.updateCart
    ) {
      return;
    }

    this.setPendingFocus(quantityInput, quantity === 0);
    this.quantityQueue.set(lineId, quantity);
    this.flushQuantityQueue();
    this.syncBusyState();
  }

  setPendingFocus(control, removing) {
    this.pendingFocusId = control.dataset.cartFocusId;
    this.pendingFocusFromPointer = this.interactedByPointer;

    if (!removing) return;

    const lines = Array.from(this.querySelectorAll(".cart-item"));
    const index = lines.indexOf(control.closest(".cart-item"));
    const nearbyLines = [...lines.slice(index + 1), ...lines.slice(0, index).reverse()];

    // A parent removal can delete queued child lines, so keep these fallbacks through later quantity edits.
    this.pendingRemovalFocusIds = nearbyLines
      .map((line) => line.querySelector("[data-cart-line-remove]")?.dataset.cartFocusId)
      .filter(Boolean);
  }

  flushQuantityQueue() {
    if (this.pendingUpdates || this.lineRequestPending || !this.quantityQueue.size) return;

    const lines = Array.from(this.quantityQueue, ([id, quantity]) => ({ id, quantity })).filter(({ id }) =>
      this.querySelector(`.cart-item[data-cart-line-id="${CSS.escape(id)}"]`),
    );

    this.quantityQueue.clear();

    // Only the fresh markup can confirm that a queued line survived a parent removal.
    if (lines.length) void this.updateLines(lines, "cart-quantity");
  }

  async updateLines(lines, source) {
    this.lineRequestPending = true;
    this.syncBusyState();

    try {
      await window.Shopify.actions.updateCart(
        { lines },
        {
          event: {
            context: this.dataset.context === "drawer" ? "dialog" : "cart",
            detail: { source },
          },
        },
      );
    } catch (error) {
      console.error("[Cart] Line update failed", error);
    } finally {
      this.lineRequestPending = false;
      this.flushQuantityQueue();
      this.syncBusyState();
    }
  }

  syncBusyState() {
    const busy = this.pendingUpdates > 0 || this.lineRequestPending || this.quantityQueue.size > 0;
    const summary = document.querySelector(
      `[data-cart-summary][data-context="${CSS.escape(this.dataset.context)}"]`,
    );
    const checkout = summary?.querySelector('[name="checkout"]');

    if (busy) {
      this.setAttribute("aria-busy", "true");
      checkout?.setAttribute("aria-disabled", "true");
    } else {
      this.removeAttribute("aria-busy");
      checkout?.removeAttribute("aria-disabled");
      this.pendingFocusId = null;
      this.pendingRemovalFocusIds = [];
    }
  }

  onCheckoutSubmit(event) {
    const summary = event.target.closest("[data-cart-summary]");

    if (
      event.target.matches("[data-cart-checkout-form]") &&
      summary?.dataset.context === this.dataset.context &&
      this.getAttribute("aria-busy") === "true"
    ) {
      event.preventDefault();
    }
  }

  finishUpdate() {
    this.pendingUpdates -= 1;
    this.flushQuantityQueue();
    this.syncBusyState();
  }

  async onCartLinesUpdate(event) {
    this.pendingUpdates += 1;
    this.syncBusyState();

    try {
      let result;

      try {
        result = await event.promise;
      } catch (error) {
        console.error("[Cart] Cart update failed", error);
      }

      const { cart, userErrors = [], warnings = [] } = result || {};
      const hasIssues = userErrors.length > 0 || warnings.length > 0;

      if (cart) {
        updateCartDrawerViewPayload(cart);

        const cartOptions = document.querySelector(
          `[data-cart-options][data-context="${CSS.escape(this.dataset.context)}"]`,
        );
        const cartHeading = document.querySelector("[data-cart-heading]");

        if (cartOptions) cartOptions.hidden = cart.totalQuantity === 0;
        if (cartHeading) cartHeading.classList.toggle("visually-hidden", cart.totalQuantity === 0);
      }

      try {
        if (cart && this.dataset.context === "drawer" && event.action === "add" && !hasIssues) {
          const cartDialog = document.getElementById("cart-dialog")?.closest("theme-dialog");

          if (cartDialog) {
            cartDialog.openedByPointer = event.detail?.openedByPointer === true;
            cartDialog.setReturnFocus(document.activeElement);
          }

          await window.Shopify.actions.openCart();
        }

        // Failed mutations also need fresh markup to restore the server quantity before draining the queue.
        await this.render();
      } catch (error) {
        console.error("[Cart] Cart rendering failed", error);

        document.dispatchEvent(new CustomEvent("theme:cart:render-error"));
      }
    } finally {
      this.finishUpdate();
    }
  }

  async onCartDiscountUpdate(event) {
    this.pendingUpdates += 1;
    this.syncBusyState();

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
      this.finishUpdate();
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

    nextCartItems.querySelectorAll("[id]").forEach((element) => {
      element.id = element.id.replace(renderedId, this.id);
    });

    nextCartSummary.id = currentCartSummary.id;
    nextCartSummary.className = currentCartSummary.className;
    nextCartSummary.dataset.context = this.dataset.context;

    const focusId = this.pendingFocusId;
    const restoreFocusFromPointer = this.pendingFocusFromPointer;

    currentCartSummary.replaceWith(nextCartSummary);
    // Keep the queue and event listeners alive across every full line-list replacement.
    this.replaceChildren(...nextCartItems.childNodes);
    this.syncBusyState();

    this.quantityQueue.forEach((quantity, id) => {
      const input = this.querySelector(`[data-cart-line-quantity][data-cart-line-id="${CSS.escape(id)}"]`);

      if (!input) return;

      input.value = String(quantity);
      // Fresh server limits can invalidate a quantity queued before this render.
      input.closest("quantity-input")?.onInputChange();
      this.quantityQueue.set(id, Number(input.value));
    });

    if (focusId) {
      const focusIds = [focusId, ...(this.pendingRemovalFocusIds || [])];
      const focusElement = focusIds
        .map((id) => this.querySelector(`[data-cart-focus-id="${CSS.escape(id)}"]`))
        .find(Boolean) || this.querySelector('[data-cart-focus-id="empty"], .cart-item-title a');

      if (focusElement && restoreFocusFromPointer) {
        focusElement.dataset.focusedBy = "pointer";
        focusElement.addEventListener("blur", () => delete focusElement.dataset.focusedBy, { once: true });
      }

      focusElement?.focus();
    }
  }
}

if (!customElements.get("cart-items")) {
  customElements.define("cart-items", CartItems);
}
