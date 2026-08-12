/*
  Gift card script

  This file owns interactions available only on issued gift card pages.
*/

class GiftCardCopy extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.button = this.querySelector("[data-gift-card-copy-button]");
    this.input = this.querySelector("[data-gift-card-copy-input]");
    this.status = this.querySelector("[data-gift-card-copy-status]");

    if (!this.button || !this.input || !this.status) return;

    this.listenerController = new AbortController();
    this.button.addEventListener("click", this.copy.bind(this), {
      signal: this.listenerController.signal,
    });
    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    window.clearTimeout(this.resetTimer);
    this.isInitialized = false;
  }

  async copy() {
    let copied;

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(this.input.value);
        copied = true;
      } catch {
        copied = this.copyWithLegacyCommand();
      }
    } else {
      copied = this.copyWithLegacyCommand();
    }

    if (!copied) return;

    this.button.textContent = this.button.dataset.copiedText;
    this.status.textContent = this.button.dataset.copiedText;
    window.clearTimeout(this.resetTimer);
    this.resetTimer = window.setTimeout(() => {
      this.button.textContent = this.button.dataset.copyText;
      this.status.textContent = "";
    }, 2000);
  }

  copyWithLegacyCommand() {
    try {
      this.input.disabled = false;
      this.input.select();
      const copied = document.execCommand("copy");

      this.input.disabled = true;
      return copied;
    } catch {
      this.input.disabled = true;
      return false;
    }
  }
}

if (!customElements.get("gift-card-copy")) {
  customElements.define("gift-card-copy", GiftCardCopy);
}

class GiftCardQrCode extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized || !this.dataset.identifier || !window.QRCode) return;

    new window.QRCode(this, {
      text: this.dataset.identifier,
      width: 160,
      height: 160,
    });
    this.isInitialized = true;
  }
}

if (!customElements.get("gift-card-qr-code")) {
  customElements.define("gift-card-qr-code", GiftCardQrCode);
}
