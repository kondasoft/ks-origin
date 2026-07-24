/*
  Components script

  This file defines reusable custom elements shared across theme components.
  Keep section-specific behavior in the section's dedicated script.
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
    this.triggers = Array.from(
      document.querySelectorAll(`[data-toggle="${this.dialog.id}"]`),
    );
    this.onDialogClose = this.onDialogClose.bind(this);
    this.onDialogCancel = this.onDialogCancel.bind(this);
    this.onDialogClick = this.onDialogClick.bind(this);
    this.onInternalClick = this.onInternalClick.bind(this);

    this.triggers.forEach((trigger) => {
      trigger.setAttribute("aria-controls", this.dialog.id);
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.addEventListener(
        "click",
        this.onTriggerClick.bind(this, trigger),
        { signal: this.listenerController.signal },
      );
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
    this.addEventListener("click", this.onInternalClick, {
      signal: this.listenerController.signal,
    });
    this.isInitialized = true;
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


class MobileMenuDialog extends HTMLElement {
  static closeDurationMs = 180;

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
      this.closeSubmenu(backButton.closest(".mobile-menu-submenu"));
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

  closeSubmenu(submenu) {
    if (!submenu) return;

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
