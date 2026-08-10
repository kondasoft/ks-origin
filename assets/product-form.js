/*
  Product form script

  This file owns theme add-to-cart forms, product-line mutations, and form feedback.
*/

class ThemeProductForm extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.form = this.querySelector('form[action*="/cart/add"]');

    if (!this.form) return;

    this.listenerController = new AbortController();
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
    submitButton.focus({ preventScroll: true });

    try {
      const result = await window.Shopify.actions.updateCart(
        { lines: [line] },
        {
          event: {
            context: this.dataset.cartContext || "product",
            detail: { source: this.dataset.source || "theme-product-form" },
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

if (!customElements.get("theme-product-form")) {
  customElements.define("theme-product-form", ThemeProductForm);
}
