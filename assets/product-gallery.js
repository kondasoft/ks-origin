/*
  Product gallery script

  This file owns product gallery navigation and transitions, plus the optional full-screen viewer and image zoom.
*/

class ProductGallery extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.stage = this.querySelector("[data-product-gallery-stage]");
    this.track = this.querySelector("[data-product-gallery-track]");
    this.slides = Array.from(this.querySelectorAll("[data-product-gallery-slide]"));
    this.thumbnails = Array.from(this.querySelectorAll("[data-product-gallery-thumbnail]"));
    this.thumbnailList = this.querySelector("[data-product-gallery-thumbnails]");
    this.status = this.querySelector("[data-product-gallery-status]");
    this.counter = this.querySelector("[data-product-gallery-counter]");
    this.videoAutoplay = this.dataset.videoAutoplay === "true";

    if (!this.stage || !this.track || !this.slides.length) return;

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

    this.currentIndex = Math.max(
      0,
      this.slides.findIndex((slide) => slide.classList.contains("is-active")),
    );
    this.thumbnailWindowStart = 0;

    if (this.thumbnailList && this.thumbnails.length) {
      this.updateThumbnailLayout();
      this.resizeObserver = new ResizeObserver(() => {
        this.updateThumbnailLayout();
      });
      this.resizeObserver.observe(this.thumbnailList);
    }

    this.isInitialized = true;
    this.showImage(this.currentIndex, false);
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.resizeObserver?.disconnect();
    cancelAnimationFrame(this.thumbnailScrollFrame);
    this.isInitialized = false;
  }

  onClick(event) {
    if (event.target.closest("[data-product-gallery-previous]")) {
      this.showImage(this.currentIndex - 1);
      return;
    }

    if (event.target.closest("[data-product-gallery-next]")) {
      this.showImage(this.currentIndex + 1);
      return;
    }

    const thumbnail = event.target.closest("[data-product-gallery-thumbnail]");

    if (thumbnail) {
      this.showImage(Number.parseInt(thumbnail.dataset.index, 10));
      return;
    }

    this.openViewerFromImage(event);
  }

  openViewerFromImage(event) {
    const expandButton = this.querySelector("[data-viewer-open]");

    if (!expandButton || !event.target.closest('[data-product-gallery-slide][data-media-type="image"]')) return;

    // A touch swipe can still end in a click on the image, which must not open the viewer.
    const pointerDistance = Math.hypot(event.clientX - this.pointerDownX, event.clientY - this.pointerDownY);

    if (pointerDistance > 10) return;

    this.querySelector("product-gallery-viewer")?.open(expandButton, true);
  }

  onKeydown(event) {
    if (event.target !== this.stage) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    this.showImage(event.key === "ArrowRight" ? this.currentIndex + 1 : this.currentIndex - 1);
  }

  onPointerDown(event) {
    if (!event.isPrimary) return;

    this.pointerDownX = event.clientX;
    this.pointerDownY = event.clientY;

    if (event.pointerType === "mouse") return;
    const interactiveMedia =
      "button, a, input, select, textarea, video[controls], model-viewer, .shopify-model-viewer-ui";

    if (event.target.closest(interactiveMedia)) return;

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

    if (isCancelled || Math.abs(distanceX) < 40 || Math.abs(distanceX) <= Math.abs(distanceY)) {
      return;
    }

    this.showImage(distanceX < 0 ? this.currentIndex + 1 : this.currentIndex - 1);
  }

  showMedia(mediaId, announce = true) {
    if (!mediaId) return;

    const mediaIndex = this.slides.findIndex((slide) => slide.dataset.mediaId === String(mediaId));

    if (mediaIndex === -1) return;

    this.showImage(mediaIndex, announce);
  }

  showImage(index, announce = true) {
    const nextIndex = (index + this.slides.length) % this.slides.length;
    const hasChanged = nextIndex !== this.currentIndex;
    const indexDistance = Math.abs(nextIndex - this.currentIndex);
    const baseSlideDurationMs = 250;
    const slideDurationIncreaseMs = 150;
    const slideDuration = Math.min(
      1000,
      baseSlideDurationMs + Math.max(0, indexDistance - 1) * slideDurationIncreaseMs,
    );

    this.currentIndex = nextIndex;
    this.style.setProperty("--product-gallery-slide-duration", `${slideDuration}ms`);
    this.track.style.transform = `translateX(-${nextIndex * 100}%)`;

    this.slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === nextIndex;

      slide.classList.toggle("is-active", isActive);
      slide.setAttribute("aria-hidden", String(!isActive));
      slide.inert = !isActive;

      if (!isActive) {
        slide.querySelector("deferred-video")?.pause();
        slide.querySelector("deferred-model")?.pause();
      } else if (
        this.videoAutoplay &&
        slide.dataset.mediaType === "video" &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
        !slide.querySelector("deferred-video[data-user-paused]")
      ) {
        const video = slide.querySelector("video");

        if (video) {
          video.play().catch(() => {});
        } else {
          slide.querySelector("deferred-video")?.showVideo();
        }
      }
    });

    this.thumbnails.forEach((thumbnail, thumbnailIndex) => {
      if (thumbnailIndex === nextIndex) {
        thumbnail.setAttribute("aria-current", "true");
      } else {
        thumbnail.removeAttribute("aria-current");
      }
    });

    if (announce && hasChanged) {
      this.scrollActiveThumbnail();
    }

    if (announce && this.status) {
      this.status.textContent = this.status.dataset.template
        .replace("[index]", String(nextIndex + 1))
        .replace("[count]", String(this.slides.length));
    }

    if (this.counter) {
      this.counter.textContent = `${nextIndex + 1} / ${this.slides.length}`;
    }
  }

  updateThumbnailLayout() {
    const visibleCount = this.thumbnailList.updateThumbnailLayout?.();

    if (!visibleCount) return;

    this.visibleThumbnailCount = visibleCount;

    cancelAnimationFrame(this.thumbnailScrollFrame);
    this.thumbnailScrollFrame = requestAnimationFrame(() => {
      this.scrollActiveThumbnail(false);
    });
  }

  scrollActiveThumbnail(animate = true) {
    if (!this.thumbnailList || !this.visibleThumbnailCount) return;

    const previousWindowStart = this.thumbnailWindowStart;
    const lastIndex = this.thumbnails.length - 1;
    const maxWindowStart = Math.max(0, this.thumbnails.length - this.visibleThumbnailCount);

    if (this.currentIndex <= this.thumbnailWindowStart) {
      this.thumbnailWindowStart = this.currentIndex - 1;
    } else if (this.currentIndex >= this.thumbnailWindowStart + this.visibleThumbnailCount - 1) {
      this.thumbnailWindowStart =
        this.currentIndex < lastIndex
          ? this.currentIndex - this.visibleThumbnailCount + 2
          : this.currentIndex - this.visibleThumbnailCount + 1;
    }

    this.thumbnailWindowStart = Math.max(0, Math.min(this.thumbnailWindowStart, maxWindowStart));

    if (animate && this.thumbnailWindowStart === previousWindowStart) return;

    const firstVisibleThumbnail = this.thumbnails[this.thumbnailWindowStart];

    if (!firstVisibleThumbnail) return;

    const listStyles = getComputedStyle(this.thumbnailList);
    const listBounds = this.thumbnailList.getBoundingClientRect();
    const thumbnailBounds = firstVisibleThumbnail.getBoundingClientRect();
    const paddingLeft = Number.parseFloat(listStyles.paddingLeft) || 0;
    const left = this.thumbnailList.scrollLeft + thumbnailBounds.left - listBounds.left - paddingLeft;

    this.thumbnailList.scrollTo({
      left,
      behavior: animate ? listStyles.scrollBehavior : "auto",
    });
  }
}

if (!customElements.get("product-gallery")) {
  customElements.define("product-gallery", ProductGallery);
}

class ProductGalleryViewer extends HTMLElement {
  connectedCallback() {
    this.dialog = this.closest("dialog");
    this.themeDialog = this.closest("theme-dialog");
    this.track = this.querySelector("[data-viewer-track]");
    this.slides = Array.from(this.querySelectorAll("[data-viewer-slide]"));
    this.counter = this.querySelector("[data-viewer-counter]");
    this.status = this.querySelector("[data-viewer-status]");
    this.thumbnails = Array.from(this.querySelectorAll("[data-viewer-thumbnail]"));

    if (!this.dialog || !this.themeDialog || !this.track || !this.slides.length) return;

    this.currentIndex = 0;
    this.openRequest = (this.openRequest || 0) + 1;
    this.listenerController = new AbortController();

    const { signal } = this.listenerController;

    document.addEventListener("click", (event) => this.onTriggerClick(event), { signal });
    this.addEventListener("click", (event) => this.onClick(event), { signal });
    this.addEventListener("pointermove", (event) => this.onPointerMove(event), { signal });
    this.dialog.addEventListener("keydown", (event) => this.onKeydown(event), { signal });
    this.dialog.addEventListener("close", () => this.onClose(), { signal });
    this.track.addEventListener("scroll", () => this.onScroll(), { passive: true, signal });
    window.addEventListener("resize", () => this.onResize(), { signal });
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.openRequest += 1;
    this.cancelPreload();
    cancelAnimationFrame(this.scrollFrame);
    this.resetZoom();
    this.stopSlideAnimation();
    this.slides?.forEach((slide) => this.pauseMedia(slide));
  }


  /*
    Opening
  */
  onTriggerClick(event) {
    const trigger = event.target.closest(`[data-viewer-open="${this.dialog.id}"]`);

    if (trigger) this.open(trigger, event.detail !== 0);
  }

  // The gallery also calls this for image clicks, passing its expand button as the focus return target.
  async open(trigger, openedByPointer) {
    if (this.dialog.open || trigger.getAttribute("aria-busy") === "true") return;

    const carousel = trigger.closest("product-gallery");
    const activeSlide = carousel?.querySelector("[data-product-gallery-slide].is-active");
    const mediaId = activeSlide?.dataset.mediaId;
    const index = Math.max(this.slides.findIndex((slide) => slide.dataset.mediaId === String(mediaId)), 0);
    const targetImage = this.slides[index].querySelector("img.product-gallery-viewer-image");
    const requestId = ++this.openRequest;

    if (targetImage) {
      this.preloadTrigger = trigger;
      this.loadingTimer = window.setTimeout(() => trigger.classList.add("is-loading"), 150);
      trigger.setAttribute("aria-busy", "true");
      targetImage.loading = "eager";
      this.preloadController = new AbortController();
      await Promise.race([
        this.waitForImage(targetImage, this.preloadController.signal),
        this.wait(ProductGalleryViewer.preloadTimeoutMs),
      ]);
      // A section reload cancels this request; its completion must not clear a newer request's loading state.
      if (requestId !== this.openRequest) return;

      this.cancelPreload();
    }

    if (requestId !== this.openRequest || this.dialog.open || !trigger.isConnected) return;

    // Read the active slide again after preloading: a swipe or variant change may have moved the gallery.
    const currentSlide = carousel?.querySelector("[data-product-gallery-slide].is-active");

    if (currentSlide?.dataset.mediaId !== mediaId) {
      this.open(trigger, openedByPointer);
      return;
    }

    this.pauseMedia(currentSlide);
    this.setCurrent(index, false);
    this.themeDialog.setReturnFocus(trigger);
    this.themeDialog.openedByPointer = openedByPointer;
    this.themeDialog.openDialog();
    this.show(index, false);
  }


  /*
    Closing
  */
  onClose() {
    this.openRequest += 1;
    this.resetZoom();
    this.stopSlideAnimation();
    cancelAnimationFrame(this.scrollFrame);
    this.slides.forEach((slide) => this.pauseMedia(slide));

    // The native close event covers Escape, the close button and programmatic dialog closes alike.
    this.closest("product-gallery")?.showMedia(this.slides[this.currentIndex].dataset.mediaId, false);
  }

  pauseMedia(slide) {
    slide?.querySelectorAll("deferred-video, deferred-model").forEach((media) => media.pause());
  }

  cancelPreload() {
    this.preloadController?.abort();
    window.clearTimeout(this.loadingTimer);
    this.preloadTrigger?.classList.remove("is-loading");
    this.preloadTrigger?.removeAttribute("aria-busy");
    this.preloadTrigger = null;
  }

  async waitForImage(image, signal) {
    if (!image.complete) {
      await new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true, signal });
        image.addEventListener("error", resolve, { once: true, signal });
      });
    }

    try {
      await image.decode();
    } catch {
      // A failed decode still lets the browser display the loaded image.
    }
  }

  wait(durationMs) {
    return new Promise((resolve) => window.setTimeout(resolve, durationMs));
  }

  prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }


  /*
    Interaction
  */
  onClick(event) {
    if (event.target.closest("[data-viewer-previous]")) {
      this.show(this.currentIndex - 1);
      return;
    }

    if (event.target.closest("[data-viewer-next]")) {
      this.show(this.currentIndex + 1);
      return;
    }

    const thumbnail = event.target.closest("[data-viewer-thumbnail]");

    if (thumbnail) {
      this.show(Number.parseInt(thumbnail.dataset.index, 10));
      return;
    }

    const zoomButton = event.target.closest("[data-viewer-zoom]");

    if (zoomButton) {
      this.toggleZoom(zoomButton, event);
      return;
    }

    if (event.target.closest("[data-viewer-frame].is-zoomed")) this.resetZoom();
  }

  onKeydown(event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (event.target.closest("video, model-viewer, .shopify-model-viewer-ui")) return;

    event.preventDefault();
    this.show(event.key === "ArrowRight" ? this.currentIndex + 1 : this.currentIndex - 1);
  }

  onResize() {
    if (!this.dialog.open) return;

    this.resetZoom();
    this.show(this.currentIndex, false);
  }

  onScroll() {
    if (this.track.classList.contains("is-animating")) return;

    cancelAnimationFrame(this.scrollFrame);
    this.scrollFrame = requestAnimationFrame(() => {
      if (!this.track.clientWidth) return;

      const index = Math.round(Math.abs(this.track.scrollLeft) / this.track.clientWidth);

      if (index !== this.currentIndex) this.setCurrent(index);
    });
  }

  onPointerMove(event) {
    if (event.pointerType !== "mouse") return;

    const frame = event.target.closest("[data-viewer-frame]");

    if (!frame) return;

    if (frame.classList.contains("is-zoomed")) {
      this.panTo(frame, event.clientX, event.clientY);
    }
  }


  /*
    Slides
  */
  show(index, animate = true) {
    const nextIndex = (index + this.slides.length) % this.slides.length;
    const nextSlide = this.slides[nextIndex];
    const canAnimate = animate && !this.prefersReducedMotion();
    const isAdjacent = Math.abs(nextIndex - this.currentIndex) === 1;

    this.resetZoom();
    this.stopSlideAnimation();

    if (canAnimate && this.dataset.transition === "slide" && isAdjacent) {
      this.animateScroll(nextSlide.offsetLeft);
    } else {
      this.track.scrollTo({ left: nextSlide.offsetLeft, behavior: "instant" });

      if (canAnimate) this.fadeIn(nextSlide);
    }

    this.setCurrent(nextIndex, canAnimate);
  }

  animateScroll(targetLeft) {
    const startLeft = this.track.scrollLeft;
    const distance = targetLeft - startLeft;
    const startTime = performance.now();

    // Scroll snapping would fight each animation frame, so it is paused until the slide settles.
    this.track.classList.add("is-animating");

    const step = (now) => {
      const progress = Math.min((now - startTime) / ProductGalleryViewer.slideDurationMs, 1);
      const easedProgress = 1 - (1 - progress) ** 3;

      this.track.scrollLeft = startLeft + distance * easedProgress;

      if (progress < 1) {
        this.slideFrame = requestAnimationFrame(step);
        return;
      }

      this.track.classList.remove("is-animating");
    };

    this.slideFrame = requestAnimationFrame(step);
  }

  stopSlideAnimation() {
    cancelAnimationFrame(this.slideFrame);
    this.track?.classList.remove("is-animating");
    this.slides?.forEach((slide) => slide.classList.remove("is-entering"));
  }

  fadeIn(slide) {
    slide.classList.remove("is-entering");
    // Reading layout restarts the animation when the same slide fades in again.
    void slide.offsetWidth;
    slide.classList.add("is-entering");
    slide.addEventListener("animationend", () => slide.classList.remove("is-entering"), {
      once: true,
      signal: this.listenerController.signal,
    });
  }

  setCurrent(index, animate = !this.prefersReducedMotion()) {
    const hasChanged = index !== this.currentIndex;

    this.currentIndex = index;
    this.slides.forEach((slide, slideIndex) => {
      slide.inert = slideIndex !== index;

      if (slideIndex !== index) this.pauseMedia(slide);
    });

    if (this.counter) this.counter.textContent = `${index + 1} / ${this.slides.length}`;

    this.thumbnails.forEach((thumbnail, thumbnailIndex) => {
      if (thumbnailIndex === index) {
        thumbnail.setAttribute("aria-current", "true");
        this.scrollThumbnailIntoView(thumbnail, animate);
      } else {
        thumbnail.removeAttribute("aria-current");
      }
    });

    if (hasChanged && this.status) {
      this.status.textContent = this.status.dataset.template
        .replace("[index]", String(index + 1))
        .replace("[count]", String(this.slides.length));
    }
  }

  scrollThumbnailIntoView(thumbnail, animate) {
    const list = thumbnail.closest("[data-viewer-thumbnails]");

    if (!list || list.scrollWidth <= list.clientWidth) return;

    const item = thumbnail.parentElement;
    const left = item.offsetLeft - list.offsetLeft - (list.clientWidth - item.offsetWidth) / 2;

    list.scrollTo({ left, behavior: animate ? "smooth" : "instant" });
  }


  /*
    Zoom
  */
  toggleZoom(button, event) {
    const frame = button.closest("[data-viewer-frame]");

    if (frame.classList.contains("is-zoomed")) {
      this.resetZoom();
      return;
    }

    const ratio = Number.parseFloat(button.dataset.mediaRatio) || 1;
    const mediaWidth = Number.parseFloat(button.dataset.mediaWidth) || 0;
    const fittedWidth = Math.min(frame.clientWidth, frame.clientHeight * ratio);
    const zoomWidth = Math.round(Math.min(fittedWidth * 2.5, Math.max(mediaWidth, fittedWidth * 1.5)));
    const image = button.querySelector("img");

    if (image) image.sizes = `${zoomWidth}px`;

    button.style.width = `${zoomWidth}px`;
    button.style.height = `${Math.round(zoomWidth / ratio)}px`;
    button.setAttribute("aria-pressed", "true");
    frame.classList.add("is-zoomed");
    this.track.classList.add("is-locked");

    // Keyboard activation reports no pointer position, so zoom toward the center.
    const hasPointer = event.detail !== 0;
    const bounds = frame.getBoundingClientRect();

    this.panTo(
      frame,
      hasPointer ? event.clientX : bounds.left + bounds.width / 2,
      hasPointer ? event.clientY : bounds.top + bounds.height / 2,
    );
  }

  panTo(frame, clientX, clientY) {
    const bounds = frame.getBoundingClientRect();
    const ratioX = Math.min(Math.max((clientX - bounds.left) / bounds.width, 0), 1);
    const ratioY = Math.min(Math.max((clientY - bounds.top) / bounds.height, 0), 1);

    frame.scrollLeft = ratioX * (frame.scrollWidth - frame.clientWidth);
    frame.scrollTop = ratioY * (frame.scrollHeight - frame.clientHeight);
  }

  resetZoom() {
    this.track?.classList.remove("is-locked");
    this.querySelectorAll("[data-viewer-frame].is-zoomed").forEach((frame) => {
      const button = frame.querySelector("[data-viewer-zoom]");

      frame.classList.remove("is-zoomed");
      frame.scrollTo(0, 0);
      button.style.removeProperty("width");
      button.style.removeProperty("height");
      button.setAttribute("aria-pressed", "false");
    });
  }
}

ProductGalleryViewer.slideDurationMs = 220;
ProductGalleryViewer.preloadTimeoutMs = 4000;

if (!customElements.get("product-gallery-viewer")) {
  customElements.define("product-gallery-viewer", ProductGalleryViewer);
}
