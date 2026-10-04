import { formatIsoDate } from "#public/utils/format-iso-date.js";
import { onReady } from "#public/utils/on-ready.js";

const FORM_SELECTOR = "form.contact-form";

const maskDateInput = (dateInput) => {
  if (!dateInput.value || !dateInput.name) return;
  const hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.name = dateInput.name;
  hidden.value = formatIsoDate(dateInput.value);
  dateInput.removeAttribute("name");
  dateInput.insertAdjacentElement("afterend", hidden);
};

export const formatDateInputs = (form) => {
  for (const dateInput of form.querySelectorAll('input[type="date"]')) {
    maskDateInput(dateInput);
  }
};

onReady(() => {
  for (const form of document.querySelectorAll(FORM_SELECTOR)) {
    form.addEventListener("submit", () => {
      formatDateInputs(form);
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      button.textContent = "Submitting..";
    });
  }
});
