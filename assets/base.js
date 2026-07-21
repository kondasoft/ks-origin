/*
  Section styles loading on demand
*/
function loadSectionStyles(root = document) {
  root.querySelectorAll("[data-section-css]").forEach((element) => {
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

/*
  Section scripts loading on demand
*/
function loadSectionScripts(root = document) {
  root.querySelectorAll("[data-section-js]").forEach((element) => {
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

loadSectionStyles();
loadSectionScripts();

document.addEventListener("shopify:section:load", (event) => {
  loadSectionStyles(event.target);
  loadSectionScripts(event.target);
});
