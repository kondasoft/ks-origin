/*
  Quick add script

  This file owns product loading, modal presentation, and image navigation for Quick add.
*/

class QuickAdd extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.dialogHost = this.querySelector("theme-dialog");
    this.content = this.querySelector("[data-quick-add-content]");

    if (!this.dialogHost || !this.content) return;

    this.cache = new Map();
    this.listenerController = new AbortController();
    document.addEventListener("click", this.onDocumentClick.bind(this), {
      signal: this.listenerController.signal,
    });
    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.requestController?.abort();
    this.isInitialized = false;
  }

  async onDocumentClick(event) {
    const trigger = event.target.closest("[data-quick-add-url]");

    if (!trigger) return;

    event.preventDefault();
    await this.load(trigger, event.detail !== 0);
  }

  async load(trigger, openedByPointer) {
    const productUrl = trigger.dataset.quickAddUrl;

    if (!productUrl) return;

    this.requestController?.abort();
    this.setTriggerLoading(trigger, true);
    this.content.innerHTML = `<p role="status">${this.escapeHtml(this.content.dataset.loadingText)}</p>`;

    try {
      const html = await this.fetchSection(productUrl);

      this.content.innerHTML = html;
      this.dialogHost.setReturnFocus(trigger);
      this.dialogHost.openedByPointer = openedByPointer;
      this.dialogHost.openDialog();
    } catch (error) {
      if (error.name === "AbortError") return;

      this.content.innerHTML = `<p class="alert alert-with-icon alert-error">${this.escapeHtml(
        this.content.dataset.unavailableText,
      )}</p>`;
      this.dialogHost.setReturnFocus(trigger);
      this.dialogHost.openedByPointer = openedByPointer;
      this.dialogHost.openDialog();
    } finally {
      this.setTriggerLoading(trigger, false);
    }
  }

  async fetchSection(productUrl) {
    const url = new URL(productUrl, window.location.origin);

    url.searchParams.set("section_id", "quick-add");

    if (this.cache.has(url.href)) return this.cache.get(url.href);

    this.requestController = new AbortController();
    const response = await fetch(url, { signal: this.requestController.signal });

    if (!response.ok) throw new Error(`Quick add request failed with status ${response.status}`);

    const html = await response.text();

    if (!html.includes("data-quick-add-product")) throw new Error("Quick add product markup was not returned");

    this.cache.set(url.href, html);
    return html;
  }

  setTriggerLoading(trigger, isLoading) {
    trigger.classList.toggle("loading", isLoading);
    trigger.toggleAttribute("aria-busy", isLoading);
    trigger.disabled = isLoading;
  }

  escapeHtml(value) {
    const element = document.createElement("span");

    element.textContent = value || "";
    return element.innerHTML;
  }
}

if (!customElements.get("quick-add")) {
  customElements.define("quick-add", QuickAdd);
}


class QuickAddGallery extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.stage = this.querySelector("[data-quick-add-gallery-stage]");
    this.track = this.querySelector("[data-quick-add-gallery-track]");
    this.slides = Array.from(this.querySelectorAll("[data-quick-add-gallery-slide]"));
    this.counter = this.querySelector("[data-quick-add-gallery-counter]");
    this.status = this.querySelector("[data-quick-add-gallery-status]");

    if (!this.stage || !this.track || !this.slides.length) return;

    this.currentIndex = Math.max(
      0,
      this.slides.findIndex((slide) => slide.classList.contains("is-active")),
    );
    this.listenerController = new AbortController();
    this.addEventListener("click", this.onClick.bind(this), {
      signal: this.listenerController.signal,
    });
    this.stage.addEventListener("keydown", this.onKeydown.bind(this), {
      signal: this.listenerController.signal,
    });
    this.stage.addEventListener("pointerdown", this.onPointerDown.bind(this), {
      signal: this.listenerController.signal,
    });
    this.stage.addEventListener("pointerup", this.onPointerEnd.bind(this), {
      signal: this.listenerController.signal,
    });
    this.stage.addEventListener("pointercancel", this.onPointerEnd.bind(this), {
      signal: this.listenerController.signal,
    });
    this.isInitialized = true;
    this.showImage(this.currentIndex, false);
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.isInitialized = false;
  }

  onClick(event) {
    if (event.target.closest("[data-quick-add-gallery-previous]")) {
      this.showImage(this.currentIndex - 1);
      return;
    }

    if (event.target.closest("[data-quick-add-gallery-next]")) {
      this.showImage(this.currentIndex + 1);
    }
  }

  onKeydown(event) {
    if (event.target !== this.stage) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    this.showImage(event.key === "ArrowRight" ? this.currentIndex + 1 : this.currentIndex - 1);
  }

  onPointerDown(event) {
    if (!event.isPrimary || event.pointerType === "mouse") return;
    if (event.target.closest("button, a, input, select, textarea")) return;

    this.swipePointerId = event.pointerId;
    this.swipeStartX = event.clientX;
    this.swipeStartY = event.clientY;
    this.stage.setPointerCapture(event.pointerId);
  }

  onPointerEnd(event) {
    if (event.pointerId !== this.swipePointerId) return;

    const distanceX = event.clientX - this.swipeStartX;
    const distanceY = event.clientY - this.swipeStartY;
    const isCancelled = event.type === "pointercancel";

    this.swipePointerId = null;

    if (isCancelled || Math.abs(distanceX) < 40 || Math.abs(distanceX) <= Math.abs(distanceY)) return;

    this.showImage(distanceX < 0 ? this.currentIndex + 1 : this.currentIndex - 1);
  }

  showMedia(mediaId, announce = true) {
    if (!mediaId) return;

    const mediaIndex = this.slides.findIndex((slide) => slide.dataset.mediaId === String(mediaId));

    if (mediaIndex !== -1) this.showImage(mediaIndex, announce);
  }

  showImage(index, announce = true) {
    const nextIndex = (index + this.slides.length) % this.slides.length;
    const hasChanged = nextIndex !== this.currentIndex;

    this.currentIndex = nextIndex;
    this.track.style.transform = `translateX(-${nextIndex * 100}%)`;

    this.slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === nextIndex;

      slide.classList.toggle("is-active", isActive);
      slide.setAttribute("aria-hidden", String(!isActive));
      slide.inert = !isActive;
    });

    if (this.counter) this.counter.textContent = `${nextIndex + 1} / ${this.slides.length}`;

    if (announce && hasChanged && this.status) {
      this.status.textContent = this.status.dataset.template
        .replace("[index]", String(nextIndex + 1))
        .replace("[count]", String(this.slides.length));
    }
  }
}

if (!customElements.get("quick-add-gallery")) {
  customElements.define("quick-add-gallery", QuickAddGallery);
}
