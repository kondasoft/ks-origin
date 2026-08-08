/*
  Product gallery script

  This file owns media selection, navigation, and transition state for the main product gallery.
  Keep product variant and media-type behavior in their respective product scripts.
*/

class ProductGallery extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.stage = this.querySelector("[data-product-gallery-stage]");
    this.track = this.querySelector("[data-product-gallery-track]");
    this.slides = Array.from(
      this.querySelectorAll("[data-product-gallery-slide]"),
    );
    this.thumbnails = Array.from(
      this.querySelectorAll("[data-product-gallery-thumbnail]"),
    );
    this.thumbnailList = this.querySelector(
      "[data-product-gallery-thumbnails]",
    );
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
    }
  }

  onKeydown(event) {
    if (event.target !== this.stage) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    this.showImage(
      event.key === "ArrowRight" ? this.currentIndex + 1 : this.currentIndex - 1,
    );
  }

  showImage(index, announce = true) {
    const nextIndex = (index + this.slides.length) % this.slides.length;
    const hasChanged = nextIndex !== this.currentIndex;
    const indexDistance = Math.abs(nextIndex - this.currentIndex);
    const slideDuration = Math.min(
      800,
      250 + Math.max(0, indexDistance - 1) * 100,
    );

    this.currentIndex = nextIndex;
    this.style.setProperty(
      "--product-gallery-slide-duration",
      `${slideDuration}ms`,
    );
    this.track.style.transform = `translateX(-${nextIndex * 100}%)`;

    this.slides.forEach((slide, slideIndex) => {
      const isActive = slideIndex === nextIndex;

      slide.classList.toggle("is-active", isActive);
      slide.setAttribute("aria-hidden", String(!isActive));
      slide.inert = !isActive;

      if (!isActive) {
        slide.querySelector("video")?.pause();
      } else if (this.videoAutoplay) {
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
    const styles = getComputedStyle(this.thumbnailList);
    const gap = Number.parseFloat(styles.columnGap) || 0;
    const padding =
      (Number.parseFloat(styles.paddingLeft) || 0) +
      (Number.parseFloat(styles.paddingRight) || 0);
    const minimumSize =
      Number.parseFloat(
        styles.getPropertyValue("--product-gallery-thumbnail-min"),
      ) || 40;
    const maximumSize =
      Number.parseFloat(
        styles.getPropertyValue("--product-gallery-thumbnail-max"),
      ) || 140;
    const availableWidth = this.thumbnailList.clientWidth - padding;
    const maximumVisible = Math.max(
      1,
      Math.floor((availableWidth + gap) / (minimumSize + gap)),
    );
    const visibleCount = Math.min(this.thumbnails.length, maximumVisible);
    const thumbnailSize = Math.max(
      minimumSize,
      Math.min(
        maximumSize,
        (availableWidth - gap * (visibleCount - 1)) / visibleCount,
      ),
    );

    this.thumbnailList.style.setProperty(
      "--product-gallery-thumbnail-size",
      `${thumbnailSize}px`,
    );
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
    const maxWindowStart = Math.max(
      0,
      this.thumbnails.length - this.visibleThumbnailCount,
    );

    if (this.currentIndex <= this.thumbnailWindowStart) {
      this.thumbnailWindowStart = this.currentIndex - 1;
    } else if (
      this.currentIndex >=
      this.thumbnailWindowStart + this.visibleThumbnailCount - 1
    ) {
      this.thumbnailWindowStart =
        this.currentIndex < lastIndex
          ? this.currentIndex - this.visibleThumbnailCount + 2
          : this.currentIndex - this.visibleThumbnailCount + 1;
    }

    this.thumbnailWindowStart = Math.max(
      0,
      Math.min(this.thumbnailWindowStart, maxWindowStart),
    );

    if (animate && this.thumbnailWindowStart === previousWindowStart) return;

    const firstVisibleThumbnail =
      this.thumbnails[this.thumbnailWindowStart];

    if (!firstVisibleThumbnail) return;

    const listStyles = getComputedStyle(this.thumbnailList);
    const listBounds = this.thumbnailList.getBoundingClientRect();
    const thumbnailBounds = firstVisibleThumbnail.getBoundingClientRect();
    const paddingLeft = Number.parseFloat(listStyles.paddingLeft) || 0;
    const left =
      this.thumbnailList.scrollLeft +
      thumbnailBounds.left -
      listBounds.left -
      paddingLeft;

    this.thumbnailList.scrollTo({
      left,
      behavior: animate ? listStyles.scrollBehavior : "auto",
    });
  }
}

if (!customElements.get("product-gallery")) {
  customElements.define("product-gallery", ProductGallery);
}
