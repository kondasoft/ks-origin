/*
  Components script

  This file defines reusable custom elements shared across theme components.
  Keep section-specific behavior in the section's dedicated script.
*/


/*
  Intersection observer
*/
const intersectionObservers = new Map();
const elementObservers = new WeakMap();
const intersectionObserverSelector = "[data-intersection-observer]";
const initializedIntersectionObserverSelector =
  "[data-intersection-initialized]";

function getMatchingElements(root, selector) {
  const elements = Array.from(root.querySelectorAll(selector));

  if (root instanceof Element && root.matches(selector)) {
    elements.unshift(root);
  }

  return elements;
}

function enterWithoutIntersectionObserver(element) {
  element.dataset.intersectionInitialized = "true";
  element.dataset.intersectionState = "entered";
  element.dispatchEvent(
    new CustomEvent("theme:intersection", {
      detail: { isIntersecting: true, target: element },
    }),
  );
}

function getIntersectionObserver(rootMargin, threshold) {
  const observerKey = `${rootMargin}:${threshold}`;

  if (intersectionObservers.has(observerKey)) {
    return intersectionObservers.get(observerKey);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const element = entry.target;
        const observeOnce = element.dataset.intersectionOnce !== "false";

        element.dataset.intersectionState = entry.isIntersecting
          ? "entered"
          : "exited";
        element.dispatchEvent(
          new CustomEvent("theme:intersection", {
            detail: entry,
          }),
        );

        if (entry.isIntersecting && observeOnce) {
          observer.unobserve(element);
          elementObservers.delete(element);
        }
      });
    },
    { rootMargin, threshold },
  );

  intersectionObservers.set(observerKey, observer);
  return observer;
}

function initIntersectionObservers(root = document) {
  const elements = getMatchingElements(
    root,
    `${intersectionObserverSelector}:not([data-intersection-initialized])`,
  );

  elements.forEach((element) => {
    if (!("IntersectionObserver" in window)) {
      enterWithoutIntersectionObserver(element);
      return;
    }

    const rootMargin = element.dataset.intersectionRootMargin || "0px";
    const parsedThreshold = Number.parseFloat(
      element.dataset.intersectionThreshold || "0",
    );
    const threshold = Math.min(
      1,
      Math.max(0, Number.isFinite(parsedThreshold) ? parsedThreshold : 0),
    );
    let observer;

    try {
      observer = getIntersectionObserver(rootMargin, threshold);
      observer.observe(element);
    } catch {
      try {
        observer = getIntersectionObserver("0px", threshold);
        observer.observe(element);
      } catch {
        enterWithoutIntersectionObserver(element);
        return;
      }
    }

    elementObservers.set(element, observer);
    element.dataset.intersectionInitialized = "true";
  });
}

function cleanupIntersectionObservers(root) {
  getMatchingElements(root, initializedIntersectionObserverSelector).forEach(
    (element) => {
      elementObservers.get(element)?.unobserve(element);
      elementObservers.delete(element);
      delete element.dataset.intersectionInitialized;
      delete element.dataset.intersectionState;
    },
  );
}

initIntersectionObservers();
document.addEventListener("shopify:section:load", (event) => {
  initIntersectionObservers(event.target);
});
document.addEventListener("shopify:section:unload", (event) => {
  cleanupIntersectionObservers(event.target);
});


/*
  Deferred video
*/
class DeferredVideo extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.posterButton = this.querySelector("[data-deferred-video-button]");
    this.videoTemplate = this.querySelector("template");

    if (!this.posterButton || !this.videoTemplate) return;

    this.listenerController = new AbortController();
    this.posterButton.addEventListener(
      "click",
      this.onPosterClick.bind(this),
      { signal: this.listenerController.signal },
    );

    if (this.hasAttribute("autoplay")) {
      this.addEventListener(
        "theme:intersection",
        this.onIntersection.bind(this),
        { signal: this.listenerController.signal },
      );

      if (this.dataset.intersectionState === "entered") {
        this.showVideo();
      }
    }

    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.mediaController?.abort();

    if (this.dataset.mediaLoading === "true") {
      this.activeMedia?.remove();
      delete this.dataset.mediaLoading;
      this.posterButton?.removeAttribute("aria-busy");
    }

    this.activeMedia = undefined;
    this.shouldMoveMediaFocus = false;
    this.isInitialized = false;
  }

  onPosterClick() {
    this.shouldMoveMediaFocus = true;
    this.showVideo();
  }

  onIntersection(event) {
    if (event.detail.isIntersecting) {
      this.showVideo();
    }
  }

  showVideo() {
    if (
      this.dataset.mediaLoading === "true" ||
      this.dataset.mediaLoaded === "true"
    ) {
      return;
    }

    const content = this.videoTemplate.content.cloneNode(true);
    const media = content.querySelector("video, iframe");

    if (!media) return;

    this.dataset.mediaLoading = "true";
    this.posterButton.setAttribute("aria-busy", "true");
    this.mediaController?.abort();
    this.mediaController = new AbortController();
    this.activeMedia = media;

    const readyEvent =
      media instanceof HTMLVideoElement ? "playing" : "load";
    const listenerOptions = {
      once: true,
      signal: this.mediaController.signal,
    };

    media.addEventListener(
      readyEvent,
      () => this.onMediaReady(media),
      listenerOptions,
    );
    media.addEventListener(
      "error",
      () => this.onMediaError(media),
      listenerOptions,
    );
    this.videoTemplate.before(content);

    if (media instanceof HTMLVideoElement) {
      media.play().catch(() => this.onMediaError(media));
    }
  }

  onMediaReady(media) {
    if (
      this.activeMedia !== media ||
      this.dataset.mediaLoading !== "true"
    ) {
      return;
    }

    const shouldMoveMediaFocus =
      this.shouldMoveMediaFocus && document.activeElement === this.posterButton;

    this.mediaController?.abort();
    delete this.dataset.mediaLoading;
    this.dataset.mediaLoaded = "true";
    this.posterButton.removeAttribute("aria-busy");
    this.posterButton.disabled = true;
    this.posterButton.setAttribute("aria-hidden", "true");
    this.activeMedia = undefined;
    this.shouldMoveMediaFocus = false;

    if (!shouldMoveMediaFocus) return;

    if (media instanceof HTMLVideoElement && !media.controls) {
      media.tabIndex = -1;
    }

    media.focus({ preventScroll: true });
  }

  onMediaError(media) {
    if (
      this.activeMedia !== media ||
      this.dataset.mediaLoading !== "true"
    ) {
      return;
    }

    this.mediaController?.abort();
    media.remove();
    delete this.dataset.mediaLoading;
    this.posterButton.removeAttribute("aria-busy");
    this.posterButton.disabled = false;
    this.posterButton.removeAttribute("aria-hidden");
    this.activeMedia = undefined;
    this.shouldMoveMediaFocus = false;
  }
}

if (!customElements.get("deferred-video")) {
  customElements.define("deferred-video", DeferredVideo);
}


/*
  Dialogs
*/
class ThemeDialog extends HTMLElement {
  static instanceCount = 0;
  static closeDurationMs = 300;

  connectedCallback() {
    if (this.isInitialized) return;

    this.dialog = this.querySelector("dialog");

    if (!this.dialog) return;

    this.openedByPointer = false;

    if (!this.dialog.id) {
      ThemeDialog.instanceCount += 1;
      this.dialog.id = `theme-dialog-${ThemeDialog.instanceCount}`;
    }

    this.listenerController = new AbortController();
    this.triggers = [];
    this.onDialogClose = this.onDialogClose.bind(this);
    this.onDialogCancel = this.onDialogCancel.bind(this);
    this.onDialogClick = this.onDialogClick.bind(this);
    this.onDialogKeydown = this.onDialogKeydown.bind(this);
    this.onInternalClick = this.onInternalClick.bind(this);
    this.onSectionLoad = this.onSectionLoad.bind(this);

    this.bindTriggers(document);

    document.addEventListener("shopify:section:load", this.onSectionLoad, {
      signal: this.listenerController.signal,
    });
    this.dialog.addEventListener("close", this.onDialogClose, {
      signal: this.listenerController.signal,
    });
    this.dialog.addEventListener("cancel", this.onDialogCancel, {
      signal: this.listenerController.signal,
    });
    this.dialog.addEventListener("click", this.onDialogClick, {
      signal: this.listenerController.signal,
    });
    this.dialog.addEventListener("keydown", this.onDialogKeydown, {
      signal: this.listenerController.signal,
    });
    this.addEventListener("click", this.onInternalClick, {
      signal: this.listenerController.signal,
    });
    this.isInitialized = true;
  }

  bindTriggers(root) {
    this.triggers = this.triggers.filter((trigger) => trigger.isConnected);

    const selector = `[data-toggle="${this.dialog.id}"]`;

    getMatchingElements(root, selector).forEach((trigger) => {
      if (this.triggers.includes(trigger)) return;

      trigger.setAttribute("aria-controls", this.dialog.id);
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.addEventListener(
        "click",
        this.onTriggerClick.bind(this, trigger),
        { signal: this.listenerController.signal },
      );
      this.triggers.push(trigger);
    });
  }

  onSectionLoad(event) {
    this.bindTriggers(event.target);
  }

  disconnectedCallback() {
    this.unlockPageScroll();
    this.listenerController?.abort();
    window.clearTimeout(this.closeTimer);
    this.isInitialized = false;
  }

  onTriggerClick(trigger, event) {
    event.preventDefault();
    this.lastTrigger = trigger;
    this.openedByPointer = event.detail !== 0;
    this.openDialog();
  }

  openDialog() {
    if (this.dialog.open) {
      this.requestClose();
      return;
    }

    this.closeOtherOpenDialogs();
    this.dialog.classList.remove("is-closing");
    this.isClosing = false;
    this.dialog.dataset.openedBy = this.openedByPointer
      ? "pointer"
      : "keyboard";
    this.dialog.showModal();
    this.setExpandedState(true);
    this.lockPageScroll();
  }

  onDialogClose() {
    this.dialog.classList.remove("is-closing");
    delete this.dialog.dataset.openedBy;
    this.setExpandedState(false);
    this.isClosing = false;

    if (!document.querySelector("dialog:modal")) {
      this.unlockPageScroll();
    }

    window.clearTimeout(this.closeTimer);
    this.closeTimer = null;
    this.lastTrigger?.focus();
  }

  onDialogCancel(event) {
    event.preventDefault();
    this.requestClose();
  }

  onDialogClick(event) {
    if (event.target !== this.dialog) return;

    const rect = this.dialog.getBoundingClientRect();
    const clickedOutside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;

    if (clickedOutside) this.requestClose();
  }

  onDialogKeydown(event) {
    if (event.key === "Tab") {
      this.dialog.dataset.openedBy = "keyboard";
    }
  }

  onInternalClick(event) {
    const closeButton = event.target.closest("[data-dialog-close]");

    if (closeButton && this.contains(closeButton)) {
      this.requestClose();
    }
  }

  requestClose() {
    if (!this.dialog?.open || this.isClosing) return;

    this.isClosing = true;
    this.dialog.classList.add("is-closing");

    const closeDurationMs = this.getCloseDurationMs();

    if (closeDurationMs === 0) {
      this.dialog.close();
      return;
    }

    window.clearTimeout(this.closeTimer);
    this.closeTimer = window.setTimeout(
      () => this.dialog.close(),
      closeDurationMs,
    );
  }

  getCloseDurationMs() {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const designMode = document.documentElement.dataset.designMode === "true";

    if (reduceMotion || designMode) return 0;

    const duration = window
      .getComputedStyle(this.dialog)
      .getPropertyValue("--dialog-transition-duration")
      .trim();
    const parsedDuration = Number.parseFloat(duration);

    if (!Number.isFinite(parsedDuration) || parsedDuration < 0) {
      return ThemeDialog.closeDurationMs;
    }

    return duration.endsWith("ms") ? parsedDuration : parsedDuration * 1000;
  }

  setExpandedState(isExpanded) {
    this.triggers.forEach((trigger) => {
      trigger.setAttribute("aria-expanded", String(isExpanded));
    });
  }

  closeOtherOpenDialogs() {
    document.querySelectorAll("dialog[open]").forEach((openDialog) => {
      if (openDialog === this.dialog) return;

      const dialogHost = openDialog.closest("theme-dialog");

      if (dialogHost?.requestClose) {
        dialogHost.requestClose();
      } else {
        openDialog.close();
      }
    });
  }

  lockPageScroll() {
    if (document.body.dataset.scrollLocked === "true") return;
    if (document.body.dataset.mobileMenuScrollLocked === "true") return;

    const scrollY = window.scrollY;

    document.body.dataset.scrollLocked = "true";
    document.body.dataset.scrollLockTop = String(scrollY);
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }

  unlockPageScroll() {
    if (document.body.dataset.scrollLocked !== "true") return;

    const scrollY = Number(document.body.dataset.scrollLockTop || 0);

    delete document.body.dataset.scrollLocked;
    delete document.body.dataset.scrollLockTop;
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    window.scrollTo(0, scrollY);
  }
}

if (!customElements.get("theme-dialog")) {
  customElements.define("theme-dialog", ThemeDialog);
}


class ThemeDropdown extends HTMLElement {
  static instanceCount = 0;

  connectedCallback() {
    if (this.isInitialized) return;

    this.button = this.querySelector(".theme-dropdown-btn");
    this.content = this.querySelector(".theme-dropdown-content");

    if (!this.button || !this.content) return;

    if (!this.content.id) {
      ThemeDropdown.instanceCount += 1;
      this.content.id = `theme-dropdown-${ThemeDropdown.instanceCount}`;
    }

    this.listenerController = new AbortController();
    this.button.setAttribute("aria-controls", this.content.id);
    this.button.setAttribute("aria-expanded", "false");
    this.button.setAttribute("aria-haspopup", "true");
    this.content.hidden = true;

    this.button.addEventListener("click", this.onButtonClick.bind(this), {
      signal: this.listenerController.signal,
    });
    document.addEventListener("click", this.onDocumentClick.bind(this), {
      signal: this.listenerController.signal,
    });
    this.addEventListener("keydown", this.onKeydown.bind(this), {
      signal: this.listenerController.signal,
    });
    this.addEventListener("focusout", this.onFocusOut.bind(this), {
      signal: this.listenerController.signal,
    });
    this.addEventListener("pointerdown", this.onPointerDown.bind(this), {
      signal: this.listenerController.signal,
    });
    document.addEventListener("pointerup", this.onPointerEnd.bind(this), {
      signal: this.listenerController.signal,
    });
    document.addEventListener("pointercancel", this.onPointerEnd.bind(this), {
      signal: this.listenerController.signal,
    });
    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    window.clearTimeout(this.focusOutTimer);
    this.isPointerInteracting = false;
    this.isInitialized = false;
  }

  onButtonClick(event) {
    event.preventDefault();
    this.toggle();
  }

  onDocumentClick(event) {
    if (this.contains(event.target)) return;

    this.close();
  }

  onKeydown(event) {
    if (event.key === "Escape") {
      if (!this.isOpen()) return;

      event.preventDefault();
      this.close();
      this.button.focus();
      return;
    }

    if (event.key === "ArrowDown" && event.target === this.button) {
      event.preventDefault();
      this.open();
      this.focusFirstItem();
    }
  }

  onFocusOut() {
    if (this.isPointerInteracting) return;

    window.clearTimeout(this.focusOutTimer);
    this.focusOutTimer = window.setTimeout(() => {
      if (!this.contains(document.activeElement)) this.close();
    });
  }

  onPointerDown() {
    this.isPointerInteracting = true;
  }

  onPointerEnd() {
    this.isPointerInteracting = false;
  }

  isOpen() {
    return this.button?.getAttribute("aria-expanded") === "true";
  }

  toggle() {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    if (!this.button || !this.content || this.isOpen()) return;

    this.closeOtherDropdowns();
    this.button.setAttribute("aria-expanded", "true");
    this.content.hidden = false;
  }

  close() {
    if (!this.button || !this.content || !this.isOpen()) return;

    this.button.setAttribute("aria-expanded", "false");
    this.content.hidden = true;
  }

  closeOtherDropdowns() {
    document.querySelectorAll("theme-dropdown").forEach((dropdown) => {
      if (dropdown !== this) dropdown.close?.();
    });
  }

  focusFirstItem() {
    const firstItem = this.content.querySelector(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    firstItem?.focus();
  }
}

if (!customElements.get("theme-dropdown")) {
  customElements.define("theme-dropdown", ThemeDropdown);
}


class ThemeCollapse extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.details = this.querySelector(".theme-collapse-details");
    this.summary = this.querySelector(".theme-collapse-summary");

    if (!this.details || !this.summary) return;

    this.listenerController = new AbortController();
    this.reduceMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    this.desktopQuery = window.matchMedia("(min-width: 1200px)");
    this.summary.addEventListener(
      "click",
      this.onSummaryClick.bind(this),
      { signal: this.listenerController.signal },
    );

    if (this.hasAttribute("data-collapse-mobile")) {
      this.desktopQuery.addEventListener(
        "change",
        this.onDesktopQueryChange.bind(this),
        { signal: this.listenerController.signal },
      );
      this.syncResponsiveState();
    }

    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.finishAnimation?.();
    window.clearTimeout(this.animationTimer);
    this.isInitialized = false;
  }

  onSummaryClick(event) {
    event.preventDefault();

    if (this.details.dataset.animating === "true") return;

    const isOpen = this.details.open;

    if (this.reduceMotionQuery.matches) {
      this.details.open = !isOpen;
      return;
    }

    const startHeight = this.details.offsetHeight;

    if (!isOpen) {
      this.details.open = true;
    }

    const endHeight = isOpen
      ? this.summary.offsetHeight
      : this.details.scrollHeight;

    this.details.dataset.animating = "true";
    this.details.style.height = `${startHeight}px`;
    this.details.style.overflow = "hidden";

    window.requestAnimationFrame(() => {
      this.details.style.height = `${endHeight}px`;
    });

    const cleanup = () => {
      if (isOpen) {
        this.details.open = false;
      }

      this.details.style.height = "";
      this.details.style.overflow = "";
      delete this.details.dataset.animating;
      this.details.removeEventListener("transitionend", onTransitionEnd);
      window.clearTimeout(this.animationTimer);
      this.finishAnimation = null;
    };

    const onTransitionEnd = (transitionEvent) => {
      if (
        transitionEvent.target !== this.details ||
        transitionEvent.propertyName !== "height"
      ) {
        return;
      }

      cleanup();
    };

    this.finishAnimation = cleanup;
    this.details.addEventListener("transitionend", onTransitionEnd);
    this.animationTimer = window.setTimeout(cleanup, 350);
  }

  onDesktopQueryChange() {
    this.finishAnimation?.();
    this.syncResponsiveState();
  }

  syncResponsiveState() {
    this.details.open = this.desktopQuery.matches;
  }
}

if (!customElements.get("theme-collapse")) {
  customElements.define("theme-collapse", ThemeCollapse);
}


class MobileMenuDialog extends HTMLElement {
  static closeDurationMs = 180;
  static submenuBackDelayMs = 200;

  connectedCallback() {
    if (this.isInitialized) return;

    this.panel = this.querySelector("[data-mobile-menu-panel]");
    this.backdrop = this.querySelector("[data-mobile-menu-backdrop]");
    this.trigger = document.querySelector(
      `[data-toggle="${this.panel?.id}"]`,
    );

    if (!this.panel || !this.backdrop || !this.trigger) return;

    this.listenerController = new AbortController();
    this.desktopQuery = window.matchMedia("(min-width: 1200px)");

    this.trigger.setAttribute("aria-controls", this.panel.id);
    this.trigger.setAttribute("aria-expanded", "false");
    this.trigger.removeAttribute("aria-haspopup");
    this.trigger.addEventListener("click", this.onTriggerClick.bind(this), {
      signal: this.listenerController.signal,
    });
    this.panel.addEventListener(
      "click",
      this.onMobileMenuClick.bind(this),
      { signal: this.listenerController.signal },
    );
    this.panel.addEventListener(
      "keydown",
      this.onMobileMenuKeydown.bind(this),
      { signal: this.listenerController.signal },
    );
    this.panel.addEventListener(
      "transitionend",
      this.onPanelTransitionEnd.bind(this),
      { signal: this.listenerController.signal },
    );
    this.backdrop.addEventListener("click", this.onBackdropClick.bind(this), {
      signal: this.listenerController.signal,
    });
    document.addEventListener("click", this.onDocumentClick.bind(this), {
      signal: this.listenerController.signal,
    });
    window.addEventListener("resize", this.updatePanelTop.bind(this), {
      signal: this.listenerController.signal,
    });
    this.desktopQuery.addEventListener(
      "change",
      this.onDesktopQueryChange.bind(this),
      { signal: this.listenerController.signal },
    );
    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.closeMenu(false, true);
    this.listenerController?.abort();
    window.clearTimeout(this.closeTimer);
    window.clearTimeout(this.submenuCloseTimer);
    this.isInitialized = false;
  }

  onTriggerClick(event) {
    event.preventDefault();

    if (this.isOpen) {
      this.closeMenu(true);
    } else {
      this.openMenu();
    }
  }

  openMenu() {
    if (this.isOpen) return;

    window.clearTimeout(this.closeTimer);
    this.closeTimer = null;
    document
      .querySelector("#header-group")
      ?.classList.remove("header-hidden");
    this.updatePanelTop();
    this.panel.hidden = false;
    this.backdrop.hidden = false;
    this.setPageInteractive(false);
    this.lockPageScroll();
    this.panel.getBoundingClientRect();
    this.dataset.open = "true";
    this.trigger.setAttribute("aria-expanded", "true");
  }

  closeMenu(returnFocus = false, immediate = false) {
    if (!this.isOpen && this.panel?.hidden) return;

    window.clearTimeout(this.submenuCloseTimer);
    this.submenuCloseTimer = null;
    delete this.dataset.open;
    this.trigger?.setAttribute("aria-expanded", "false");
    this.resetSubmenus();
    this.setPageInteractive(true);
    this.unlockPageScroll();

    if (returnFocus) {
      this.trigger?.focus();
    }

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (immediate || reduceMotion) {
      this.hidePanel();
      return;
    }

    window.clearTimeout(this.closeTimer);
    this.closeTimer = window.setTimeout(
      () => this.hidePanel(),
      this.getCloseDurationMs(),
    );
  }

  get isOpen() {
    return this.dataset.open === "true";
  }

  onPanelTransitionEnd(event) {
    if (event.propertyName === "transform" && !this.isOpen) {
      this.hidePanel();
    }
  }

  onBackdropClick(event) {
    event.stopPropagation();
    this.closeMenu(true);
  }

  onDocumentClick(event) {
    if (!this.isOpen) return;
    if (event.target.closest("dialog[open]")) return;
    if (this.panel.contains(event.target) || this.trigger.contains(event.target))
      return;

    this.closeMenu(false);
  }

  hidePanel() {
    if (this.isOpen) return;

    window.clearTimeout(this.closeTimer);
    this.closeTimer = null;
    this.panel.hidden = true;
    this.backdrop.hidden = true;
  }

  getCloseDurationMs() {
    const duration = window
      .getComputedStyle(this)
      .getPropertyValue("--mobile-menu-close-duration")
      .trim();
    const parsedDuration = Number.parseFloat(duration);

    if (!Number.isFinite(parsedDuration) || parsedDuration < 0) {
      return MobileMenuDialog.closeDurationMs;
    }

    return duration.endsWith("ms") ? parsedDuration : parsedDuration * 1000;
  }

  updatePanelTop() {
    const headerGroup = document.querySelector("#header-group");
    const headerBottom = Math.max(
      headerGroup?.getBoundingClientRect().bottom || 0,
      0,
    );

    this.style.setProperty("--mobile-menu-top", `${headerBottom}px`);
  }

  setPageInteractive(isInteractive) {
    const main = document.querySelector("#main");
    const footer = document.querySelector("#footer-group");

    if (main) main.inert = !isInteractive;
    if (footer) footer.inert = !isInteractive;
    this.setBackgroundControlsInteractive(isInteractive);
  }

  setBackgroundControlsInteractive(isInteractive) {
    if (!isInteractive) {
      const controls = document.querySelectorAll(
        "#header-group a, #header-group button, #header-group input, " +
          "#header-group select, #header-group textarea, " +
          "#header-group [tabindex], body > .skip-link",
      );

      this.backgroundControlStates = Array.from(controls)
        .filter(
          (control) =>
            control !== this.trigger && !this.panel.contains(control),
        )
        .map((control) => ({
          control,
          wasInert: control.inert,
        }));

      this.backgroundControlStates.forEach(({ control }) => {
        control.inert = true;
      });
      return;
    }

    this.backgroundControlStates?.forEach(({ control, wasInert }) => {
      if (control.isConnected) {
        control.inert = wasInert;
      }
    });
    this.backgroundControlStates = [];
  }

  lockPageScroll() {
    if (document.body.dataset.mobileMenuScrollLocked === "true") return;

    document.body.dataset.mobileMenuScrollLocked = "true";
    document.body.style.overflow = "hidden";
  }

  unlockPageScroll() {
    if (document.body.dataset.mobileMenuScrollLocked !== "true") return;

    delete document.body.dataset.mobileMenuScrollLocked;
    document.body.style.overflow = "";
  }

  onMobileMenuClick(event) {
    const toggle = event.target.closest("[data-submenu-toggle]");

    if (toggle && this.panel.contains(toggle)) {
      const submenu = document.getElementById(
        toggle.getAttribute("aria-controls"),
      );
      const isExpanded = toggle.getAttribute("aria-expanded") === "true";

      if (!submenu) return;

      toggle.setAttribute("aria-expanded", String(!isExpanded));
      submenu.hidden = isExpanded;

      if (isExpanded) {
        this.setMenuLayerInteractive(toggle, true);
      } else {
        this.setMenuLayerInteractive(toggle, false);

        if (event.detail === 0) {
          window.setTimeout(() => {
            if (!submenu.hidden) {
              submenu.querySelector("a, button")?.focus();
            }
          }, 220);
        } else {
          toggle.blur();
        }
      }

      return;
    }

    const backButton = event.target.closest("[data-submenu-back]");

    if (backButton && this.panel.contains(backButton)) {
      this.closeSubmenu(
        backButton.closest(".mobile-menu-submenu"),
        MobileMenuDialog.submenuBackDelayMs,
      );
    }
  }

  onMobileMenuKeydown(event) {
    if (event.key !== "Escape") return;

    const submenu = event.target.closest(".mobile-menu-submenu");

    if (!submenu) {
      event.preventDefault();
      this.closeMenu(true);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.closeSubmenu(submenu);
  }

  onDesktopQueryChange(event) {
    if (event.matches) {
      this.closeMenu(false, true);
    }
  }

  closeSubmenu(submenu, delayMs = 0) {
    if (!submenu) return;

    if (delayMs > 0) {
      window.clearTimeout(this.submenuCloseTimer);
      this.submenuCloseTimer = window.setTimeout(() => {
        this.submenuCloseTimer = null;

        if (this.isOpen && !submenu.hidden) {
          this.closeSubmenu(submenu);
        }
      }, delayMs);
      return;
    }

    const toggle = submenu.previousElementSibling;

    if (!toggle?.matches("[data-submenu-toggle]")) return;

    this.setMenuLayerInteractive(toggle, true);
    toggle.setAttribute("aria-expanded", "false");
    submenu.hidden = true;
    toggle.focus();
  }

  setMenuLayerInteractive(toggle, isInteractive) {
    const item = toggle.closest("li");
    const list = item?.parentElement;

    if (!item || !list) return;

    Array.from(list.children).forEach((listItem) => {
      if (listItem !== item) {
        listItem.inert = !isInteractive;
      }
    });

    if (list.matches(".mobile-menu-list")) {
      const secondaryList = this.panel.querySelector(
        ".mobile-menu-secondary-list",
      );

      if (secondaryList) {
        secondaryList.inert = !isInteractive;
      }
    }

    if (isInteractive) {
      toggle.removeAttribute("aria-hidden");
      toggle.removeAttribute("tabindex");
    } else {
      toggle.setAttribute("aria-hidden", "true");
      toggle.setAttribute("tabindex", "-1");
    }
  }

  resetSubmenus() {
    this.panel
      .querySelectorAll("[data-submenu-toggle]")
      .forEach((toggle) => {
        toggle.setAttribute("aria-expanded", "false");
        toggle.removeAttribute("aria-hidden");
        toggle.removeAttribute("tabindex");
      });
    this.panel
      .querySelectorAll(".mobile-menu-submenu")
      .forEach((submenu) => {
        submenu.hidden = true;
      });
    this.panel.querySelectorAll("[inert]").forEach((element) => {
      element.inert = false;
    });
  }
}

if (!customElements.get("mobile-menu-dialog")) {
  customElements.define("mobile-menu-dialog", MobileMenuDialog);
}


class LocalizationCountryFilter extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.input = this.querySelector(
      "[data-localization-country-filter-input]",
    );
    this.items = Array.from(
      this.querySelectorAll("[data-localization-country-item]"),
    );
    this.emptyMessage = this.querySelector(".localization-filter-empty");
    this.status = this.querySelector(
      "[data-localization-country-filter-status]",
    );

    if (!this.input) return;

    this.listenerController = new AbortController();
    this.input.addEventListener("input", this.onInput.bind(this), {
      signal: this.listenerController.signal,
    });
    this.updateStatus(this.items.length);
    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.isInitialized = false;
  }

  onInput() {
    const query = this.input.value.trim().toLowerCase();
    let visibleCount = 0;

    this.items.forEach((item) => {
      const itemText = item.dataset.filterText?.toLowerCase() || "";
      const isVisible = !query || itemText.includes(query);

      item.hidden = !isVisible;

      if (isVisible) {
        visibleCount += 1;
      }
    });

    if (this.emptyMessage) {
      this.emptyMessage.hidden = visibleCount > 0;
    }

    this.updateStatus(visibleCount);
  }

  updateStatus(visibleCount) {
    if (!this.status) return;

    if (visibleCount === 0) {
      this.status.textContent = this.status.dataset.textNoResults;
      return;
    }

    const statusText =
      visibleCount === 1
        ? this.status.dataset.textResultsOne
        : this.status.dataset.textResultsOther;

    this.status.textContent =
      statusText?.replace("[count]", visibleCount) || "";
  }
}

if (!customElements.get("localization-country-filter")) {
  customElements.define(
    "localization-country-filter",
    LocalizationCountryFilter,
  );
}


/*
  Share
*/
class ShareComponent extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.shareButton = this.querySelector("[data-share-button]");
    this.copyButton = this.querySelector("[data-share-copy]");
    this.urlInput = this.querySelector("[data-share-url-input]");
    this.dialog = this.querySelector("theme-dialog");

    if (!this.shareButton) return;

    this.listenerController = new AbortController();
    this.addEventListener("click", this.onShareClick.bind(this), {
      capture: true,
      signal: this.listenerController.signal,
    });
    this.copyButton?.addEventListener("click", this.onCopyClick.bind(this), {
      signal: this.listenerController.signal,
    });
    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    window.clearTimeout(this.copyResetTimer);
    this.isInitialized = false;
  }

  async onShareClick(event) {
    const shareButton = event.target.closest("[data-share-button]");

    if (!shareButton || !this.contains(shareButton) || !navigator.share) return;

    event.preventDefault();
    event.stopPropagation();

    try {
      await navigator.share({
        title: shareButton.dataset.shareTitle,
        url: shareButton.dataset.shareUrl,
      });
    } catch (error) {
      if (error.name === "AbortError") return;

      this.dialog.lastTrigger = shareButton;
      this.dialog.openedByPointer = event.detail !== 0;
      this.dialog.openDialog();
    }
  }

  async onCopyClick() {
    if (!this.urlInput || !this.copyButton) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(this.urlInput.value);
      } else {
        this.urlInput.select();

        if (!document.execCommand("copy")) return;
      }
    } catch {
      return;
    }

    this.copyButton.textContent = this.copyButton.dataset.textCopied;
    window.clearTimeout(this.copyResetTimer);
    this.copyResetTimer = window.setTimeout(() => {
      this.copyButton.textContent = this.copyButton.dataset.textCopy;
    }, 2000);
  }
}

if (!customElements.get("share-component")) {
  customElements.define("share-component", ShareComponent);
}
