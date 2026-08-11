/*
  Storefront actions script

  This file connects Shopify's standard storefront actions to the theme's cart UI.
*/

document.addEventListener("DOMContentLoaded", () => {
    if (!window.Shopify?.actions) return;

    window.Shopify.actions.updateCart.configure({
      eventTarget: () => null,
    });

    window.Shopify.actions.openCart.configure({
      handler() {
        const { cartType, cartUrl } = document.documentElement.dataset;

        if (cartType === "drawer") {
          const cartDialogElement = document.getElementById("cart-dialog");
          const cartDialog = cartDialogElement?.closest("theme-dialog");

          if (cartDialog && !cartDialogElement.open) cartDialog.openDialog();
          return;
        }

        if (cartType === "page" && cartUrl && window.location.pathname !== cartUrl) {
          window.location.assign(cartUrl);
        }
      },
    });
  },
  { once: true },
);
