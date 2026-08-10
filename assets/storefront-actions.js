/*
  Storefront actions script

  This file connects Shopify's standard storefront actions to the theme's cart UI.
*/

document.addEventListener("DOMContentLoaded", () => {
    if (!window.Shopify?.actions) return;

    window.Shopify.actions.updateCart.configure({
      eventTarget: () => document.querySelector("cart-items"),
    });

    window.Shopify.actions.openCart.configure({
      handler() {
        const cartDialogElement = document.getElementById("cart-dialog");
        const cartDialog = cartDialogElement?.closest("theme-dialog");

        if (cartDialog) {
          if (!cartDialogElement.open) cartDialog.openDialog();
          return;
        }

        const cartUrl = document.documentElement.dataset.cartUrl;

        if (cartUrl && window.location.pathname !== cartUrl) 
          window.location.assign(cartUrl);
      },
    });
  },
  { once: true },
);
