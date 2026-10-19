/*
  Storefront events script

  This file initializes Shopify's standard storefront events that apply globally.
*/

// Keep global analytics optional, just like the events emitted by individual components.
import("@shopify/standard-events").then(({ createViewEventElement, PageViewEvent }) => {
  if (!customElements.get("s-view-event")) {
    customElements.define("s-view-event", createViewEventElement());
  }

  const dispatchPageView = () => {
    document.dispatchEvent(
      new PageViewEvent({
        page: {
          template: document.documentElement.dataset.templateName || "",
          title: document.title,
          url: window.location.href,
        },
      }),
    );
  };

  // Dynamic imports can finish after DOMContentLoaded, unlike the original static module dependency.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", dispatchPageView, { once: true });
  } else {
    dispatchPageView();
  }
}).catch((error) => {
  console.warn("Shopify standard events are unavailable", error);
});
