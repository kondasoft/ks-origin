/*
  Base script

  This file initializes global theme behavior and shared page-level interactions.
  Keep component-specific custom elements and behavior in their respective scripts.
*/


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
  const lockedScrollY = Number(
    document.body.dataset.scrollLockTop || currentScrollY,
  );

  if (document.body.dataset.scrollLocked === "true") {
    previousScrollY = lockedScrollY;
    headerScrollFrame = null;
    return;
  }

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


/*
  Desktop header menu
*/
let headerDesktopMenuCleanup;

function initHeaderDesktopMenu() {
  if (headerDesktopMenuCleanup) {
    headerDesktopMenuCleanup();
  }

  const header = document.querySelector("#header-group .header");
  const desktopMenu = header?.querySelector("[data-desktop-menu]");

  if (!header || !desktopMenu) {
    headerDesktopMenuCleanup = undefined;
    return;
  }

  const controller = new AbortController();
  const { signal } = controller;
  const closeTimers = new Map();
  const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

  function updateBackdrop() {
    const hasOpenMenu = Boolean(
      desktopMenu.querySelector(
        '[data-menu-toggle][aria-expanded="true"]',
      ),
    );

    if (hasOpenMenu) {
      document.body.style.setProperty(
        "--header-menu-backdrop-top",
        `${Math.max(header.getBoundingClientRect().bottom, 0)}px`,
      );
      document.body.setAttribute("data-header-menu-open", "true");
    } else {
      document.body.style.removeProperty("--header-menu-backdrop-top");
      document.body.removeAttribute("data-header-menu-open");
    }
  }

  function setMenuState(toggle, expanded) {
    const panel = document.getElementById(
      toggle.getAttribute("aria-controls"),
    );

    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.closest(".header-nav-item")?.classList.toggle("menu-open", expanded);

    if (panel) {
      panel.hidden = !expanded;
    }

    updateBackdrop();
  }

  function closeMenus(exceptToggle) {
    desktopMenu.querySelectorAll("[data-menu-toggle]").forEach((toggle) => {
      if (toggle === exceptToggle) return;

      clearTimeout(closeTimers.get(toggle));
      closeTimers.delete(toggle);
      setMenuState(toggle, false);
    });
  }

  desktopMenu.querySelectorAll("[data-menu-toggle]").forEach((toggle) => {
    const item = toggle.closest(".header-nav-item");

    function openMenu() {
      clearTimeout(closeTimers.get(toggle));
      closeTimers.delete(toggle);
      setMenuState(toggle, true);
      closeMenus(toggle);
    }

    function scheduleClose() {
      clearTimeout(closeTimers.get(toggle));
      closeTimers.set(
        toggle,
        window.setTimeout(() => {
          setMenuState(toggle, false);
          closeTimers.delete(toggle);
        }, 120),
      );
    }

    item.addEventListener(
      "mouseenter",
      () => {
        if (hoverQuery.matches) {
          openMenu();
        }
      },
      { signal },
    );
    item.addEventListener(
      "mouseleave",
      () => {
        if (hoverQuery.matches) {
          scheduleClose();
        }
      },
      { signal },
    );
    item.addEventListener(
      "focusout",
      (event) => {
        if (!item.contains(event.relatedTarget)) {
          scheduleClose();
        }
      },
      { signal },
    );

    toggle.addEventListener(
      "click",
      () => {
        const expanded = toggle.getAttribute("aria-expanded") === "true";
        setMenuState(toggle, !expanded);
        closeMenus(toggle);
      },
      { signal },
    );

    toggle.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          openMenu();
          document
            .getElementById(toggle.getAttribute("aria-controls"))
            ?.querySelector("a, button")
            ?.focus();
        }

        if (event.key === "Escape") {
          event.preventDefault();
          setMenuState(toggle, false);
        }
      },
      { signal },
    );
  });

  desktopMenu.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape") return;

      const panel = event.target.closest("[data-menu-panel]");
      const toggle = panel
        ?.closest(".header-nav-item")
        ?.querySelector("[data-menu-toggle]");

      if (toggle?.matches("[data-menu-toggle]")) {
        setMenuState(toggle, false);
        toggle.focus();
      }
    },
    { signal },
  );

  document.addEventListener(
    "click",
    (event) => {
      if (!desktopMenu.contains(event.target)) {
        closeMenus();
      }
    },
    { signal },
  );

  window.addEventListener(
    "resize",
    () => {
      if (document.body.getAttribute("data-header-menu-open") === "true") {
        updateBackdrop();
      }
    },
    { signal },
  );

  window.addEventListener(
    "scroll",
    () => {
      if (document.body.getAttribute("data-header-menu-open") === "true") {
        updateBackdrop();
      }
    },
    { passive: true, signal },
  );

  headerDesktopMenuCleanup = () => {
    controller.abort();
    closeTimers.forEach((timer) => clearTimeout(timer));
    closeTimers.clear();
    document.body.style.removeProperty("--header-menu-backdrop-top");
    document.body.removeAttribute("data-header-menu-open");
    headerDesktopMenuCleanup = undefined;
  };
}

initHeaderDesktopMenu();
document.addEventListener("shopify:section:load", initHeaderDesktopMenu);
