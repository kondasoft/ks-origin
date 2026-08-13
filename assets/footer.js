/*
  Footer script

  This file owns responsive footer block ordering while preserving the merchant-defined desktop order.
*/

class FooterBlocks extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.newsletterBlocks = Array.from(this.querySelectorAll('[data-footer-block-type="newsletter"]'));

    if (!this.newsletterBlocks.length) return;

    this.desktopQuery = window.matchMedia("(min-width: 1200px)");
    this.listenerController = new AbortController();
    this.originalPositions = this.newsletterBlocks.map((block) => {
      const marker = document.createComment("newsletter-block-position");

      block.before(marker);
      return { block, marker };
    });
    this.desktopQuery.addEventListener("change", this.syncBlockOrder.bind(this), {
      signal: this.listenerController.signal,
    });
    this.syncBlockOrder();
    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.isInitialized = false;
  }

  syncBlockOrder() {
    if (this.desktopQuery.matches) {
      this.originalPositions.forEach(({ block, marker }) => marker.after(block));
      return;
    }

    [...this.newsletterBlocks].reverse().forEach((block) => this.prepend(block));
  }
}

if (!customElements.get("footer-blocks")) {
  customElements.define("footer-blocks", FooterBlocks);
}
