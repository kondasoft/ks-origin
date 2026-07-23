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
