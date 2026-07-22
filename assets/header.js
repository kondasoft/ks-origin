function initHeader(header) {
  if (header.dataset.headerInitialized === "true") return;

  window.requestAnimationFrame(() => {
    header.dataset.viewportEntered = "true";
  });

  header.dataset.headerInitialized = "true";
}

document.querySelectorAll("[data-header]").forEach(initHeader);

document.addEventListener("shopify:section:load", (event) => {
  event.target.querySelectorAll("[data-header]").forEach(initHeader);
});
