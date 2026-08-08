/*
  Product variant picker script

  This file resolves product option selections, dispatches Shopify's standard product selection event, and synchronizes
  variant-dependent product details. Keep gallery navigation and cart mutations in their dedicated scripts.
*/

import { ProductSelectEvent } from "@shopify/standard-events";

class ProductVariantPicker extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.productElement = this.closest(".main-product");
    this.optionGroups = Array.from(this.querySelectorAll("[data-variant-option-group]"));
    this.variants = this.parseVariants();

    if (!this.productElement || !this.optionGroups.length || !this.variants.length) return;

    this.listenerController = new AbortController();
    this.addEventListener("change", this.onOptionChange.bind(this), {
      signal: this.listenerController.signal,
    });
    this.updateOptionAvailability();
    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.isInitialized = false;
  }

  parseVariants() {
    try {
      return JSON.parse(this.querySelector("[data-product-variants]")?.textContent || "[]");
    } catch {
      return [];
    }
  }

  onOptionChange(event) {
    if (!event.target.matches("[data-variant-option]")) return;

    const selectedOptions = this.getSelectedOptions();
    const variant = this.findVariant(selectedOptions);
    const deferred = ProductSelectEvent.createPromise();

    this.productElement.dispatchEvent(
      new ProductSelectEvent({
        product: {
          id: this.dataset.productId,
          title: this.dataset.productTitle,
          handle: this.dataset.productHandle,
        },
        selectedOptions,
        promise: deferred.promise,
      }),
    );

    if (variant) this.updateUrl(variant.id);
    this.updateProduct(variant, selectedOptions);

    deferred.resolve({
      variant: this.toStandardVariant(variant, selectedOptions),
    });
  }

  getSelectedOptions() {
    return this.optionGroups.map((group) => {
      const input = group.querySelector("select[data-variant-option], input[data-variant-option]:checked");

      return {
        name: group.dataset.optionName,
        value: input?.value || "",
      };
    });
  }

  findVariant(selectedOptions) {
    const optionValues = selectedOptions.map((option) => option.value);

    return (
      this.variants.find((variant) => variant.options.every((value, index) => value === optionValues[index])) || null
    );
  }

  toStandardVariant(variant, selectedOptions) {
    if (!variant) return null;

    return {
      id: variant.gid,
      title: variant.title,
      availableForSale: variant.available,
      price: {
        amount: variant.priceAmount,
        currencyCode: this.dataset.currencyCode,
      },
      selectedOptions,
    };
  }

  updateSelectedOptionLabels(selectedOptions) {
    this.optionGroups.forEach((group, index) => {
      const output = group.querySelector("[data-selected-option-value]");

      if (output) output.textContent = selectedOptions[index].value;
    });
  }

  updateOptionAvailability() {
    const selectedValues = this.getSelectedOptions().map((option) => option.value);

    this.optionGroups.forEach((group, groupIndex) => {
      group.querySelectorAll("input[data-variant-option]").forEach((option) => {
        const candidateValues = [...selectedValues];
        candidateValues[groupIndex] = option.value;
        const isAvailable = this.variants.some(
          (variant) => variant.available && variant.options.every((value, index) => value === candidateValues[index]),
        );

        option.classList.toggle("disabled", !isAvailable);
      });
    });
  }

  updateProduct(variant, selectedOptions) {
    this.updateSelectedOptionLabels(selectedOptions);
    this.updateOptionAvailability();
    this.updateVariantInputs(variant);
    this.updatePrice(variant);
    this.updateSku(variant);
    this.updateBuyButtons(variant);
    this.updateGallery(variant);
  }

  updateVariantInputs(variant) {
    this.productElement.querySelectorAll("[data-product-variant-input]").forEach((input) => {
      input.value = variant?.id || "";
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  updatePrice(variant) {
    if (!variant) return;

    const price = this.productElement.querySelector("[data-product-price]");

    if (!price) return;

    const currentPrice = price.querySelector("[data-product-current-price]");
    const currentLabel = price.querySelector("[data-product-current-price-label]");
    const comparePrice = price.querySelector("[data-product-compare-price]");
    const compareLabel = price.querySelector("[data-product-compare-price-label]");
    const onSale = variant.compareAtPrice > variant.price;

    currentPrice.textContent = variant.priceMoney;
    currentPrice.classList.toggle("product-main-price-sale", onSale);
    currentLabel.textContent = onSale ? price.dataset.salePriceLabel : price.dataset.regularPriceLabel;
    comparePrice.textContent = onSale ? variant.compareAtPriceMoney : "";
    comparePrice.hidden = !onSale;
    compareLabel.hidden = !onSale;
  }

  updateSku(variant) {
    const skuBlock = this.productElement.querySelector("[data-product-sku-block]");
    const sku = skuBlock?.querySelector("[data-product-sku]");

    if (!skuBlock || !sku) return;

    skuBlock.hidden = !variant?.sku;
    sku.textContent = variant?.sku ? sku.dataset.template.replace("[sku]", variant.sku) : "";
  }

  updateBuyButtons(variant) {
    const buyButtons = this.productElement.querySelector("[data-product-buy-buttons]");

    if (!buyButtons) return;

    const available = Boolean(variant?.available);
    const addToCart = buyButtons.querySelector("[data-add-to-cart-button]");
    const addToCartText = buyButtons.querySelector("[data-add-to-cart-text]");
    const buyItNow = buyButtons.querySelector("[data-buy-it-now]");
    const quantity = buyButtons.querySelector("[data-quantity-input]");
    const maximum = this.getQuantityMaximum(variant);

    if (addToCart) addToCart.disabled = !available;
    if (addToCartText) {
      addToCartText.textContent = available ? buyButtons.dataset.addToCartText : buyButtons.dataset.soldOutText;
    }
    if (buyItNow) buyItNow.disabled = !available;

    if (quantity) {
      quantity.disabled = !available;

      if (maximum === null || maximum < 1) {
        quantity.removeAttribute("max");
      } else {
        quantity.max = String(maximum);
        quantity.value = String(Math.min(Number(quantity.value) || 1, maximum));
      }

      quantity.closest("quantity-input")?.sync();
    }
  }

  getQuantityMaximum(variant) {
    if (!variant || variant.inventoryManagement === null || variant.inventoryPolicy !== "deny") return null;

    return variant.inventoryQuantity > 0 ? variant.inventoryQuantity : 0;
  }

  updateGallery(variant) {
    if (!variant?.featuredMediaId) return;

    this.productElement.querySelector("product-gallery")?.showMedia(variant.featuredMediaId);
  }

  updateUrl(variantId) {
    const url = new URL(window.location.href);
    url.searchParams.set("variant", variantId);
    window.history.replaceState({ ...window.history.state, variantId }, "", url);
  }
}

if (!customElements.get("product-variant-picker")) {
  customElements.define("product-variant-picker", ProductVariantPicker);
}
