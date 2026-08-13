/*
  Product form script

  This file owns theme add-to-cart forms, product-line mutations, and form feedback.
*/

class ThemeProductForm extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.form = this.querySelector('form[action*="/cart/add"]');

    if (!this.form) return;

    this.openedByPointer = false;
    this.listenerController = new AbortController();
    this.form.addEventListener("pointerdown", () => {
      this.openedByPointer = true;
    }, { signal: this.listenerController.signal });
    this.form.addEventListener("keydown", () => {
      this.openedByPointer = false;
    }, { signal: this.listenerController.signal });
    this.form.addEventListener("submit", this.onSubmit.bind(this), {
      signal: this.listenerController.signal,
    });
    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.isInitialized = false;
  }

  async onSubmit(event) {
    const submitButton = event.submitter || this.form.querySelector('[type="submit"][name="add"]');

    if (submitButton?.name !== "add" || !window.Shopify?.actions?.updateCart) return;

    if (this.form.getAttribute("aria-busy") === "true") {
      event.preventDefault();
      return;
    }

    const line = this.createCartLine(new FormData(this.form));

    if (!line) return;

    event.preventDefault();
    this.form.setAttribute("aria-busy", "true");
    submitButton.setAttribute("aria-busy", "true");
    submitButton.setAttribute("aria-disabled", "true");
    submitButton.classList.add("loading");

    if (this.openedByPointer) {
      submitButton.dataset.focusedBy = "pointer";
      submitButton.addEventListener("blur", () => delete submitButton.dataset.focusedBy, { once: true });
    } else {
      delete submitButton.dataset.focusedBy;
    }

    submitButton.focus({ preventScroll: true });

    try {
      await window.Shopify.actions.updateCart(
        { lines: [line] },
        {
          event: {
            context: this.dataset.cartContext || "product",
            detail: {
              source: this.dataset.source || "theme-product-form",
              openedByPointer: this.openedByPointer,
            },
          },
        },
      );
    } catch (error) {
      console.error("[Cart] Product add failed", error);
    } finally {
      this.form.removeAttribute("aria-busy");
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

if (!customElements.get("theme-product-form")) {
  customElements.define("theme-product-form", ThemeProductForm);
}
