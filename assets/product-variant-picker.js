/*
  Product variant picker script

  This file resolves product option selections, dispatches Shopify's standard product selection event, and synchronizes
  variant-dependent product details.
*/

import { ProductSelectEvent } from "@shopify/standard-events";

class ProductVariantPicker extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.productElement = this.closest("[data-product-root]");
    this.optionGroups = Array.from(this.querySelectorAll("[data-variant-option-group]"));
    this.variants = this.parseVariants();

    if (!this.productElement || !this.optionGroups.length || !this.variants.length) return;

    this.listenerController = new AbortController();
    this.addEventListener("change", this.onOptionChange.bind(this), {
      signal: this.listenerController.signal,
    });
    window.addEventListener("resize", this.updateActiveButtonIndicators.bind(this), {
      signal: this.listenerController.signal,
    });
    this.updateOptionAvailability();
    this.updateActiveButtonIndicators();
    this.enableActiveButtonTransitions();
    document.fonts?.ready.then(() => {
      if (this.isConnected) this.updateActiveButtonIndicators();
    });
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

    try {
      const variant = this.findVariant(selectedOptions);

      if (variant && this.dataset.updateUrl !== "false") this.updateUrl(variant.id);
      this.updateProduct(variant, selectedOptions);

      deferred.resolve({
        variant: this.toStandardVariant(variant, selectedOptions),
      });
    } catch (error) {
      deferred.reject(error);
    }
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

  updateActiveButtonIndicators() {
    this.querySelectorAll("[data-variant-button-group]").forEach((group) => {
      const selectedButton = group.querySelector(".product-main-variant-picker-radio:has(input:checked)");

      if (!selectedButton) {
        group.style.setProperty("--variant-button-active-opacity", "0");
        delete group.dataset.activeIndicator;
        return;
      }

      group.style.setProperty("--variant-button-active-left", `${selectedButton.offsetLeft}px`);
      group.style.setProperty("--variant-button-active-top", `${selectedButton.offsetTop}px`);
      group.style.setProperty("--variant-button-active-width", `${selectedButton.offsetWidth}px`);
      group.style.setProperty("--variant-button-active-height", `${selectedButton.offsetHeight}px`);
      group.style.setProperty("--variant-button-active-opacity", "1");
      group.dataset.activeIndicator = "";
    });
  }

  enableActiveButtonTransitions() {
    requestAnimationFrame(() => {
      if (!this.isConnected) return;

      this.querySelectorAll("[data-variant-button-group]").forEach((group) => {
        group.dataset.activeIndicatorReady = "";
      });
    });
  }

  updateProduct(variant, selectedOptions) {
    this.updateSelectedOptionLabels(selectedOptions);
    this.updateOptionAvailability();
    this.updateActiveButtonIndicators();
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
    const inventoryMessage = buyButtons.querySelector("[data-cart-inventory-message]");
    const maximum = this.getQuantityMaximum(variant);
    const allInventoryInCart =
      variant?.inventoryManagement !== null &&
      variant?.inventoryPolicy === "deny" &&
      variant?.inventoryQuantity > 0 &&
      variant?.cartQuantity >= variant?.inventoryQuantity;

    if (addToCart) addToCart.disabled = !available;
    if (addToCartText) {
      addToCartText.textContent = available ? buyButtons.dataset.addToCartText : buyButtons.dataset.soldOutText;
    }
    if (buyItNow && available) {
      buyItNow.removeAttribute("aria-disabled");
      buyItNow.removeAttribute("tabindex");
    } else if (buyItNow) {
      buyItNow.setAttribute("aria-disabled", "true");
      buyItNow.tabIndex = -1;
    }
    if (inventoryMessage) inventoryMessage.hidden = !allInventoryInCart;

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
