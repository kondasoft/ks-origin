/*
  Product variant picker script

  This file resolves product option selections, dispatches Shopify's standard product selection event, and synchronizes
  variant-dependent product details.
*/

let standardEventsPromise;
const cartQuantitiesByUpdate = new WeakMap();

async function getCartQuantities(cart, updatePromise) {
  if (!cartQuantitiesByUpdate.has(updatePromise)) {
    cartQuantitiesByUpdate.set(updatePromise, (async () => {
      let lines = cart.lines;

      if (!Array.isArray(lines)) return null;

      // Standard cart lines expose IDs and quantities, but no variant ID. Ajax keys start with that ID.
      if (lines.some((line) => !/^\d+(?::|$)/.test(line.id))) {
        const cartUrl = document.documentElement.dataset.cartUrl;
        const response = await fetch(`${cartUrl}.js`, { cache: "no-store" });

        if (!response.ok) return null;

        const ajaxCart = await response.json();

        lines = ajaxCart.items?.map((item) => ({ id: String(item.variant_id), quantity: item.quantity }));
        if (!Array.isArray(lines)) return null;
      }

      const quantities = new Map();

      for (const line of lines) {
        const variantId = String(line.id).split(":")[0];

        quantities.set(variantId, (quantities.get(variantId) || 0) + line.quantity);
      }

      return quantities;
    })());
  }

  return cartQuantitiesByUpdate.get(updatePromise);
}

// Analytics is optional; a blocked CDN must not prevent variant selection.
function loadStandardEvents() {
  standardEventsPromise ??= import("@shopify/standard-events").catch((error) => {
    console.warn("Shopify standard events are unavailable", error);
    return {};
  });

  return standardEventsPromise;
}

class ProductVariantPicker extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    loadStandardEvents();
    this.productElement = this.closest("[data-product-root]");
    this.optionGroups = Array.from(this.querySelectorAll("[data-variant-option-group]"));
    this.variants = this.parseVariants();

    if (!this.productElement || !this.variants.length) return;

    this.listenerController = new AbortController();
    this.addEventListener("change", this.onOptionChange.bind(this), {
      signal: this.listenerController.signal,
    });
    window.addEventListener("resize", this.updateActiveButtonIndicators.bind(this), {
      signal: this.listenerController.signal,
    });
    for (const eventName of ["shopify:cart:lines-update", "shopify:cart:discount-update"]) {
      document.addEventListener(eventName, this.onCartUpdate.bind(this), {
        signal: this.listenerController.signal,
      });
    }
    this.updateBuyButtons(this.findVariant(this.getSelectedOptions()));
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
    this.cartUpdateToken = null;
    this.isInitialized = false;
  }

  async onCartUpdate(event) {
    const updateToken = {};

    this.cartUpdateToken = updateToken;

    try {
      const result = await event.promise;

      if (!result?.cart) return;

      const quantities = await getCartQuantities(result.cart, event.promise);

      if (!quantities || !this.isConnected || this.cartUpdateToken !== updateToken) return;

      for (const variant of this.variants) {
        variant.cartQuantity = quantities.get(String(variant.id)) || 0;
      }

      this.updateBuyButtons(this.findVariant(this.getSelectedOptions()));
    } catch {
      // Keep the last known limits if the cart mutation or optional Ajax lookup fails.
    }
  }

  parseVariants() {
    try {
      return JSON.parse(this.querySelector("[data-product-variants]")?.textContent || "[]");
    } catch {
      return [];
    }
  }

  async onOptionChange(event) {
    if (!event.target.matches("[data-variant-option]")) return;

    const { ProductSelectEvent } = await loadStandardEvents();

    if (!this.isConnected) return;

    const selectedOptions = this.getSelectedOptions();
    const deferred = ProductSelectEvent?.createPromise();

    if (ProductSelectEvent) {
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
    }

    try {
      const variant = this.findVariant(selectedOptions);

      if (variant && this.productElement.dataset.updateProductUrl === "true") {
        this.updateUrl(variant.id);
      }
      this.updateProduct(variant, selectedOptions);

      deferred?.resolve({
        variant: this.toStandardVariant(variant, selectedOptions),
      });
    } catch (error) {
      deferred?.reject(error);
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
    if (!this.optionGroups.length) return this.variants[0] || null;

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

        if (isAvailable) {
          option.removeAttribute("aria-disabled");
        } else {
          option.setAttribute("aria-disabled", "true");
        }
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
    this.updateProductDetailsLink(variant);
  }

  updateVariantInputs(variant) {
    this.productElement.querySelectorAll("[data-product-variant-input]").forEach((input) => {
      input.value = variant?.id || "";
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  updatePrice(variant) {
    const unitPrice = this.productElement.querySelector("[data-product-unit-price]");

    if (unitPrice) {
      unitPrice.hidden = !variant?.unitPriceText;
      // Shopify's formatter can include merchant currency markup, matching the initial Liquid render.
      unitPrice.querySelector("[data-unit-price-text]").innerHTML = variant?.unitPriceText || "";
    }

    if (!variant) return;

    const price = this.productElement.querySelector("[data-product-price]");

    if (!price) return;

    const currentPrice = price.querySelector("[data-product-current-price]");
    const currentLabel = price.querySelector("[data-product-current-price-label]");
    const comparePrice = price.querySelector("[data-product-compare-price]");
    const compareLabel = price.querySelector("[data-product-compare-price-label]");
    const saleBadge = price.querySelector("[data-product-sale-badge]");
    const onSale = variant.compareAtPrice > variant.price;

    currentPrice.textContent = variant.priceMoney;
    currentPrice.classList.toggle("product-main-price-sale", onSale);
    currentLabel.textContent = onSale ? price.dataset.salePriceLabel : price.dataset.regularPriceLabel;
    comparePrice.textContent = onSale ? variant.compareAtPriceMoney : "";
    comparePrice.hidden = !onSale;
    compareLabel.hidden = !onSale;

    if (saleBadge) {
      const badgeText =
        saleBadge.dataset.saleBadgeType === "value" ? variant.saleBadgeValue : variant.saleBadgePercentage;

      saleBadge.textContent = badgeText;
      saleBadge.hidden = !onSale || !badgeText;
    }
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
    const buyItNow = buyButtons.querySelector("theme-buy-it-now");
    const quantity = buyButtons.querySelector("[data-quantity-input]");
    const quantityRules = buyButtons.querySelector("[data-quantity-rules]");
    const rule = variant?.quantityRule || { min: 1, increment: 1, max: null };
    const inventoryMessage = buyButtons.querySelector("[data-cart-inventory-message]");
    const maximum = this.getQuantityMaximum(variant);
    const quantityUnavailable = maximum !== null && maximum < rule.min;
    const allInventoryInCart =
      variant?.inventoryManagement !== null &&
      variant?.inventoryPolicy === "deny" &&
      variant?.inventoryQuantity > 0 &&
      variant?.cartQuantity >= variant?.inventoryQuantity;

    if (addToCart) addToCart.disabled = !available || quantityUnavailable;
    if (addToCartText) {
      addToCartText.textContent = available ? buyButtons.dataset.addToCartText : buyButtons.dataset.soldOutText;
    }
    if (inventoryMessage) {
      inventoryMessage.hidden = !available || !quantityUnavailable;
      inventoryMessage.textContent = allInventoryInCart
        ? buyButtons.dataset.allInventoryInCartText
        : buyButtons.dataset.quantityUnavailableText;
    }

    if (quantityRules) {
      const parts = [];

      if (rule.min > 1) parts.push(quantityRules.dataset.minimumText.replace("[minimum]", rule.min));
      if (rule.increment > 1) parts.push(quantityRules.dataset.incrementsText.replace("[increment]", rule.increment));
      if (rule.max !== null) parts.push(quantityRules.dataset.maximumText.replace("[maximum]", rule.max));
      quantityRules.hidden = parts.length === 0;
      if (variant?.cartQuantity > 0) {
        parts.push(quantityRules.dataset.inCartText.replace("[quantity]", variant.cartQuantity));
      }
      quantityRules.textContent = parts.join(" · ");
    }

    if (quantity) {
      quantity.disabled = !available || quantityUnavailable;

      quantity.min = String(rule.min);
      quantity.step = String(rule.increment);

      if (maximum === null) {
        quantity.removeAttribute("max");
      } else {
        quantity.max = String(maximum);
      }

      const QuantityInput = customElements.get("quantity-input");
      const value = quantity.type === "hidden" ? rule.min : Number(quantity.value);

      quantity.value = String(QuantityInput.normalizeValue(quantity, value));

      quantity.closest("quantity-input")?.sync();
    }

    const dynamicCheckout = buyButtons.querySelector(".shopify-payment-button");

    if (dynamicCheckout) dynamicCheckout.hidden = !available || quantityUnavailable;

    // Availability changes must preserve the permalink's customisation restrictions.
    buyItNow?.updateLink?.();
  }

  getQuantityMaximum(variant) {
    if (!variant) return null;

    const rule = variant.quantityRule || { min: 1, increment: 1, max: null };
    let maximum = rule.max ?? Infinity;

    if (variant.inventoryManagement && variant.inventoryPolicy === "deny") {
      maximum = Math.min(maximum, variant.inventoryQuantity);
    }
    if (!Number.isFinite(maximum)) return null;

    return Math.max(0, Math.floor((maximum - variant.cartQuantity) / rule.increment) * rule.increment);
  }

  updateGallery(variant) {
    if (!variant?.featuredMediaId) return;

    this.productElement.querySelector("product-gallery, quick-add-gallery")?.showMedia(variant.featuredMediaId);
  }

  updateProductDetailsLink(variant) {
    const link = this.productElement.querySelector("[data-product-details-link]");

    if (!link || !variant) return;

    const url = new URL(link.href);
    url.searchParams.set("variant", variant.id);
    link.href = `${url.pathname}${url.search}${url.hash}`;
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
