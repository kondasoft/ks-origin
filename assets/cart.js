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
      await window.Shopify.actions.updateCart(
        { lines: [line] },
        {
          event: {
            context: "product",
            detail: { source: form.dataset.cartSource || "product-form" },
          },
        },
      );
    } catch (error) {
      console.error("[Cart] Product add failed", error);
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
}

new CartController();

class CartItems extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.listenerController = new AbortController();
    this.addEventListener("shopify:cart:lines-update", this.onCartLinesUpdate.bind(this), {
      signal: this.listenerController.signal,
    });
    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.isInitialized = false;
  }

  async onCartLinesUpdate(event) {
    this.setBusy(true);

    try {
      const result = await event.promise;

      console.log("[Cart] Cart update completed", result);

      const { cart } = result;

      if (!cart) return;

      this.updateCartBadges(cart.totalQuantity);

      if (this.dataset.context === "drawer") {
        await window.Shopify.actions.openCart();
      }

      await this.render();
    } catch (error) {
      console.error("[Cart] Cart update failed", error);
    } finally {
      this.setBusy(false);
    }
  }

  setBusy(isBusy) {
    if (isBusy) {
      this.setAttribute("aria-busy", "true");
      return;
    }

    this.removeAttribute("aria-busy");
  }

  async render() {
    const url = new URL(window.location.href);

    url.searchParams.set("section_id", "cart-items-render");

    const response = await fetch(url.toString(), {
      headers: { Accept: "text/html" },
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`Unable to refresh cart: ${response.status}`);

    const html = await response.text();
    const documentFragment = new DOMParser().parseFromString(html, "text/html");
    const nextCartItems = documentFragment.querySelector("cart-items");

    if (!nextCartItems) throw new Error("Rendered cart items were not found");

    const renderedId = nextCartItems.id;

    nextCartItems.id = this.id;
    nextCartItems.dataset.context = this.dataset.context;
    nextCartItems.querySelectorAll("[id]").forEach((element) => {
      element.id = element.id.replace(renderedId, this.id);
    });
    this.replaceWith(nextCartItems);
  }

  updateCartBadges(itemCount) {
    document.querySelectorAll("[data-cart-badge]").forEach((badge) => {
      badge.dataset.itemCount = itemCount;
      badge.textContent = itemCount;
    });
  }
}

if (!customElements.get("cart-items")) {
  customElements.define("cart-items", CartItems);
}
