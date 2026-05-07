import { formatIsoDate } from "#public/utils/format-iso-date.js";
import { onReady } from "#public/utils/on-ready.js";

const FORM_SELECTOR = "form.contact-form";

const replaceDateWithFormattedHidden = (dateInput) => {
  if (!dateInput.value || !dateInput.name) return;
  const hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.name = dateInput.name;
  hidden.value = formatIsoDate(dateInput.value);
  dateInput.removeAttribute("name");
  dateInput.insertAdjacentElement("afterend", hidden);
};

export const formatDateInputsForSubmission = (form) => {
  for (const dateInput of form.querySelectorAll('input[type="date"]')) {
    replaceDateWithFormattedHidden(dateInput);
  }
};

onReady(() => {
  for (const form of document.querySelectorAll(FORM_SELECTOR)) {
    form.addEventListener("submit", () => {
      formatDateInputsForSubmission(form);
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      button.textContent = "Submitting..";
    });
  }
});
