/*
  Product card script

  This file owns interactive product-card content, including swatch-driven media and link updates.
*/

class ProductCardSwatches extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.card = this.closest(".product-card");

    if (!this.card) return;

    this.listenerController = new AbortController();
    this.addEventListener("change", this.onChange.bind(this), {
      signal: this.listenerController.signal,
    });
    const selectedSwatch = this.querySelector("[data-product-card-swatch]:checked");

    if (selectedSwatch) this.updateLinks(selectedSwatch.dataset.variantUrl);

    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.isInitialized = false;
  }

  onChange(event) {
    const swatch = event.target.closest("[data-product-card-swatch]");

    if (!swatch) return;

    this.updateImage(swatch);
    this.updateLinks(swatch.dataset.variantUrl);
  }

  updateImage(swatch) {
    const currentImage = this.card.querySelector(".product-card-image");
    const imageTemplate = swatch
      .closest(".product-card-swatch-item")
      ?.querySelector("[data-product-card-swatch-image]");
    const nextImage = imageTemplate?.content.querySelector("img")?.cloneNode(true);

    if (!currentImage || !nextImage) return;

    nextImage.className = currentImage.className;
    currentImage.replaceWith(nextImage);
  }

  updateLinks(variantUrl) {
    if (!variantUrl) return;

    this.card.querySelectorAll("[data-product-card-link]").forEach((link) => {
      link.setAttribute("href", variantUrl);
    });
    this.card.querySelectorAll("[data-quick-add-url]").forEach((trigger) => {
      trigger.dataset.quickAddUrl = variantUrl;
    });
  }
}

if (!customElements.get("product-card-swatches")) {
  customElements.define("product-card-swatches", ProductCardSwatches);
}
