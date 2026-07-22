function initHeader(header) {
  if (header.dataset.headerInitialized === "true") return;

  const sentinel = header.previousElementSibling;

  if (sentinel?.matches("[data-header-sticky-sentinel]")) {
    header.stickyObserver = new IntersectionObserver(([entry]) => {
      header.classList.toggle("is-sticky", !entry.isIntersecting);
    });
    header.stickyObserver.observe(sentinel);
  }

  window.requestAnimationFrame(() => {
    header.dataset.viewportEntered = "true";
  });

  header.dataset.headerInitialized = "true";
}

document.querySelectorAll("[data-sticky-header]").forEach(initHeader);

document.addEventListener("shopify:section:load", (event) => {
  event.target.querySelectorAll("[data-sticky-header]").forEach(initHeader);
});

document.addEventListener("shopify:section:unload", (event) => {
  event.target.querySelectorAll("[data-sticky-header]").forEach((header) => {
    header.stickyObserver?.disconnect();
  });
});
