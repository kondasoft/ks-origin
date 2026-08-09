/*
  Cart script

  This file owns product-form and cart-line mutations, standard cart-event synchronization, and shared cart rendering.
*/

class CartController {
  constructor() {
    document.addEventListener("submit", this.onProductFormSubmit.bind(this));
  }

  async onProductFormSubmit(event) {
    const form = event.target.closest("form.product-main-buy-buttons-form, form.product-card-form");

    if (!form || !window.Shopify?.actions?.updateCart) return;

    const line = this.createCartLine(new FormData(form));

    if (!line) return;

    event.preventDefault();

    try {
      await window.Shopify.actions.updateCart(
        { lines: [line] },
        {
          event: {
            context: "product",
            detail: { source: "product-form" },
          },
        },
      );
    } catch (error) {
      console.error("[Cart] Product add failed", error);
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
  }

  disconnectedCallback() {
  }
}

if (!customElements.get("cart-items")) {
  customElements.define("cart-items", CartItems);
}
