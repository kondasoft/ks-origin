/*
  Product payment terms script

  This file owns the initial loading placeholder and empty spacing for Shopify's asynchronous payment terms.
  Shopify owns payment eligibility, message rendering and subsequent variant updates.
*/

class ProductPaymentTerms extends HTMLElement {
  connectedCallback() {
    const connection = {};

    this.connection = connection;
    this.form = this.querySelector("form");
    this.setAttribute("data-loading", "");
    this.setAttribute("aria-busy", "true");

    if (!this.form || !this.querySelector("shopify-payment-terms")) {
      this.finishLoading();
      return;
    }

    this.resizeObserver = new ResizeObserver(() => this.checkContent());
    this.resizeObserver.observe(this.form);
    // Eight seconds gives a slow Shopify script time to load without leaving an indefinite skeleton.
    this.loadingTimeout = window.setTimeout(() => this.finishLoading(), 8000);
    // Shopify defines the element before it loads the chunks that render the message (about 300ms later on
    // shop.kondasoft.com), so an empty element right after definition doesn't yet mean "no installments".
    customElements.whenDefined("shopify-payment-terms").then(() => {
      if (this.connection !== connection) return;

      this.renderGraceTimeout = window.setTimeout(() => this.finishLoading(), 2000);
    });
    this.checkContent();
  }

  disconnectedCallback() {
    // whenDefined cannot be cancelled; the connection token makes its pending continuation inert.
    this.connection = null;
    this.resizeObserver?.disconnect();
    window.clearTimeout(this.loadingTimeout);
    window.clearTimeout(this.renderGraceTimeout);
  }

  checkContent() {
    const hasContent = this.form?.getBoundingClientRect().height > 0;

    this.toggleAttribute("data-has-content", hasContent);
    if (hasContent && this.hasAttribute("data-loading")) this.finishLoading();
  }

  finishLoading() {
    this.removeAttribute("data-loading");
    this.removeAttribute("aria-busy");
    window.clearTimeout(this.loadingTimeout);
    window.clearTimeout(this.renderGraceTimeout);
    // Keep observing natural height changes so an empty message loses its margin and can reappear on variant change.
    this.checkContent();
  }
}

if (!customElements.get("product-payment-terms")) {
  customElements.define("product-payment-terms", ProductPaymentTerms);
}
