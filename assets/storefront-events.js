/*
  Storefront events script

  This file initializes Shopify's standard storefront events that apply globally.
*/

import { createViewEventElement, PageViewEvent } from "@shopify/standard-events";

if (!customElements.get("s-view-event")) {
  customElements.define("s-view-event", createViewEventElement());
}

document.addEventListener(
  "DOMContentLoaded",
  () => {
    document.dispatchEvent(
      new PageViewEvent({
        page: {
          template: document.documentElement.dataset.templateName || "",
          title: document.title,
          url: window.location.href,
        },
      }),
    );
  },
  { once: true },
);
