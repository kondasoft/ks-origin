/*
  Product recommendations script

  This file loads related and complementary products through Shopify's Product Recommendations API.
  Keep product-card and carousel interaction behavior in their respective shared scripts.
*/

class ProductRecommendations extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.listenerController = new AbortController();
    this.addEventListener("theme:intersection", this.onIntersection.bind(this), {
      signal: this.listenerController.signal,
    });

    this.isInitialized = true;

    if (this.dataset.intersectionState === "entered") {
      this.loadRecommendations();
    }
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.requestController?.abort();
    this.isInitialized = false;
  }

  onIntersection(event) {
    if (event.detail.isIntersecting) {
      this.loadRecommendations();
    }
  }

  async loadRecommendations() {
    if (this.dataset.recommendationsLoading === "true" || this.dataset.recommendationsPerformed === "true") {
      return;
    }

    const { url, productId, sectionId, intent } = this.dataset;

    if (!url || !productId || !sectionId) return;

    const requestUrl = new URL(url, window.location.origin);
    requestUrl.searchParams.set("product_id", productId);
    requestUrl.searchParams.set("section_id", sectionId);
    requestUrl.searchParams.set("intent", intent || "related");

    this.requestController?.abort();
    this.requestController = new AbortController();
    this.dataset.recommendationsLoading = "true";
    this.setAttribute("aria-busy", "true");

    try {
      const response = await fetch(requestUrl, {
        signal: this.requestController.signal,
      });

      if (!response.ok) throw new Error();

      const html = await response.text();
      const responseDocument = new DOMParser().parseFromString(html, "text/html");
      const recommendations = responseDocument.getElementById(this.id);

      if (!recommendations || recommendations.hidden) {
        this.hidden = true;
        return;
      }

      this.innerHTML = recommendations.innerHTML;
      this.dataset.recommendationsPerformed = "true";
      this.dataset.hasRecommendations = "true";
    } catch (error) {
      if (error.name === "AbortError") return;

      if (!window.Shopify?.designMode) {
        this.hidden = true;
      }
    } finally {
      delete this.dataset.recommendationsLoading;
      this.removeAttribute("aria-busy");
      this.requestController = undefined;
    }
  }
}

if (!customElements.get("product-recommendations")) {
  customElements.define("product-recommendations", ProductRecommendations);
}
