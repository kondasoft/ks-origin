/*
  Gift card recipient form script

  This file owns recipient delivery selection, field state, date constraints, character counts, and validation feedback.
*/

class GiftCardRecipientForm extends HTMLElement {
  connectedCallback() {
    if (this.isInitialized) return;

    this.form = this.closest("form");
    this.deliveryInputs = [...this.querySelectorAll("[data-gift-card-delivery]")];
    this.fields = this.querySelector("[data-gift-card-recipient-fields]");
    this.email = this.querySelector("[data-gift-card-recipient-email]");
    this.message = this.querySelector("[data-gift-card-recipient-message]");
    this.sendOn = this.querySelector("[data-gift-card-recipient-send-on]");
    this.control = this.querySelector("[data-gift-card-recipient-control]");
    this.offset = this.querySelector("[data-gift-card-recipient-offset]");
    this.characterCount = this.querySelector("[data-gift-card-recipient-character-count]");
    this.status = this.querySelector("[data-gift-card-recipient-status]");

    if (!this.form || !this.deliveryInputs.length || !this.fields || !this.email || !this.sendOn) return;

    this.listenerController = new AbortController();

    this.deliveryInputs.forEach((input) => {
      input.addEventListener("change", this.onDeliveryChange.bind(this), {
        signal: this.listenerController.signal,
      });
    });
    this.message?.addEventListener("input", this.updateCharacterCount.bind(this), {
      signal: this.listenerController.signal,
    });
    document.addEventListener("shopify:cart:error", this.onCartError.bind(this), {
      signal: this.listenerController.signal,
    });
    document.addEventListener("shopify:cart:lines-update", this.onCartLinesUpdate.bind(this), {
      signal: this.listenerController.signal,
    });

    this.setDateConstraints();
    this.updateCharacterCount();
    this.isInitialized = true;
  }

  disconnectedCallback() {
    this.listenerController?.abort();
    this.isInitialized = false;
  }

  onDeliveryChange(event) {
    this.setRecipientMode(event.target.value === "recipient");
  }

  setRecipientMode(isRecipient) {
    this.fields.hidden = !isRecipient;
    this.fields.querySelectorAll("input, textarea").forEach((field) => {
      field.disabled = !isRecipient;
    });
    this.email.required = isRecipient;
    this.control.disabled = !isRecipient;
    this.offset.disabled = !isRecipient;
    this.offset.value = isRecipient ? String(new Date().getTimezoneOffset()) : "";

    if (isRecipient) {
      this.email.focus();
      this.status.textContent = this.dataset.fieldsVisibleText || "";
      return;
    }

    this.clearFields();
    this.clearErrors();
    this.status.textContent = this.dataset.fieldsHiddenText || "";
  }

  clearFields() {
    this.fields.querySelectorAll("input, textarea").forEach((field) => {
      field.value = "";
    });
    this.updateCharacterCount();
  }

  setDateConstraints() {
    const today = new Date();
    const maximumDate = new Date(today);

    maximumDate.setDate(today.getDate() + 90);
    this.sendOn.min = this.formatDate(today);
    this.sendOn.max = this.formatDate(maximumDate);

    if (!this.offset.disabled) this.offset.value = String(today.getTimezoneOffset());
  }

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  updateCharacterCount() {
    if (!this.message || !this.characterCount) return;

    const template = this.characterCount.dataset.characterCountTemplate;

    if (!template) return;

    this.characterCount.textContent = template
      .replace("[used]", String(this.message.value.length))
      .replace("[max]", String(this.message.maxLength));
  }

  onCartError(event) {
    if (this.form.getAttribute("aria-busy") !== "true") return;

    const errors = event.detail?.errors;

    if (!errors || typeof errors !== "object") return;

    this.clearErrors();

    Object.entries(errors).forEach(([fieldName, messages]) => {
      const field = this.getField(fieldName);
      const error = this.querySelector(`[data-gift-card-recipient-error="${CSS.escape(fieldName)}"]`);

      if (!field || !error) return;

      error.textContent = Array.isArray(messages) ? messages.join(" ") : String(messages);
      error.hidden = false;
      field.setAttribute("aria-invalid", "true");
      field.setAttribute("aria-describedby", error.id);
    });
  }

  async onCartLinesUpdate(event) {
    if (event.action !== "add" || this.form.getAttribute("aria-busy") !== "true") return;

    try {
      const result = await event.promise;

      if (!result.userErrors?.length) this.clearErrors();
    } catch {
      return;
    }
  }

  getField(fieldName) {
    return {
      email: this.email,
      name: this.querySelector('[name="properties[Recipient name]"]'),
      message: this.message,
      send_on: this.sendOn,
    }[fieldName];
  }

  clearErrors() {
    this.querySelectorAll("[data-gift-card-recipient-error]").forEach((error) => {
      error.hidden = true;
      error.textContent = "";
    });
    this.fields.querySelectorAll("input, textarea").forEach((field) => {
      field.removeAttribute("aria-invalid");
      field.removeAttribute("aria-describedby");
    });
  }
}

if (!customElements.get("gift-card-recipient-form")) {
  customElements.define("gift-card-recipient-form", GiftCardRecipientForm);
}
