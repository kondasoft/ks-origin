/*
  Standard actions script

  This file connects Shopify's standard storefront actions to the theme's cart UI.
  Keep cart rendering, mutations, and line-item behavior in the dedicated cart script.
*/

document.addEventListener(
  "DOMContentLoaded",
  () => {
    if (!window.Shopify?.actions) return;

    window.Shopify.actions.updateCart.configure({
      eventTarget: () => document.querySelector("cart-items"),
    });

    window.Shopify.actions.openCart.configure({
      handler() {
        const cartDialog = document.getElementById("cart-dialog")?.closest("theme-dialog");

        if (cartDialog) {
          cartDialog.openDialog();
          return;
        }

        const cartUrl = document.documentElement.dataset.cartUrl;

        if (cartUrl && window.location.pathname !== cartUrl) window.location.assign(cartUrl);
      },
    });
  },
  { once: true },
);
