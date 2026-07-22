/*
  Section styles loading on demand
*/
function loadSectionStyles() {
  document.querySelectorAll("[data-section-css]").forEach((element) => {
    const hrefs = element.dataset.sectionCss.split(",");

    hrefs.forEach((href) => {
      const assetUrl = href.trim();

      if (!assetUrl || document.querySelector(`link[href="${assetUrl}"]`))
        return;

      const link = document.createElement("link");
      link.href = assetUrl;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    });
  });
}
loadSectionStyles();


/*
  Section scripts loading on demand
*/
function loadSectionScripts() {
  document.querySelectorAll("[data-section-js]").forEach((element) => {
    const srcs = element.dataset.sectionJs.split(",");

    srcs.forEach((src) => {
      const assetUrl = src.trim();

      if (!assetUrl || document.querySelector(`script[src="${assetUrl}"]`))
        return;

      const script = document.createElement("script");
      script.src = assetUrl;
      script.defer = true;
      document.head.appendChild(script);
    });
  });
}

loadSectionScripts();


/*
  Reveal header on scroll
*/
function syncHeaderGroupBehavior() {
  const headerGroup = document.querySelector("#header-group");
  const header = headerGroup?.querySelector("[data-header-behavior]");

  if (!headerGroup || !header) return;

  headerGroup.dataset.headerBehavior = header.dataset.headerBehavior;
}

syncHeaderGroupBehavior();
document.addEventListener("shopify:section:load", syncHeaderGroupBehavior);

let previousScrollY = window.scrollY;
let headerScrollFrame;

function updateRevealHeaders() {
  const currentScrollY = window.scrollY;
  const isScrollingDown = currentScrollY > previousScrollY;

  document
    .querySelectorAll('#header-group[data-header-behavior="reveal"]')
    .forEach((header) => {
      const shouldHide =
        isScrollingDown &&
        currentScrollY > header.offsetHeight &&
        !header.contains(document.activeElement);

      header.classList.toggle("header-hidden", shouldHide);
    });

  previousScrollY = currentScrollY;
  headerScrollFrame = null;
}

window.addEventListener(
  "scroll",
  () => {
    if (headerScrollFrame) return;

    headerScrollFrame = window.requestAnimationFrame(updateRevealHeaders);
  },
  { passive: true },
);
