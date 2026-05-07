import { describe, expect, test } from "bun:test";
import { formatDateInputsForSubmission } from "#public/ui/contact-form-submit.js";

const setupForm = (innerHtml) => {
  document.body.innerHTML = `<form class="contact-form">${innerHtml}</form>`;
  return document.querySelector("form.contact-form");
};

describe("formatDateInputsForSubmission", () => {
  test("replaces date input value with formatted hidden field on submission", () => {
    const form = setupForm(
      '<input type="date" name="start_date" value="2026-05-07" />',
    );

    formatDateInputsForSubmission(form);

    const data = new FormData(form);
    expect(data.get("start_date")).toBe("7 May 2026");
  });

  test("formats multiple date inputs in the same form", () => {
    const form = setupForm(`
      <input type="date" name="start_date" value="2026-05-07" />
      <input type="date" name="end_date" value="2026-05-09" />
    `);

    formatDateInputsForSubmission(form);

    const data = new FormData(form);
    expect(data.get("start_date")).toBe("7 May 2026");
    expect(data.get("end_date")).toBe("9 May 2026");
  });

  test("leaves an empty date input out of the submission", () => {
    const form = setupForm(
      '<input type="date" name="start_date" value="" />',
    );

    formatDateInputsForSubmission(form);

    const data = new FormData(form);
    expect(data.get("start_date")).toBe("");
  });

  test("does not affect non-date inputs", () => {
    const form = setupForm(`
      <input type="text" name="name" value="Alice" />
      <input type="date" name="start_date" value="2026-05-07" />
      <input type="email" name="email" value="a@example.com" />
    `);

    formatDateInputsForSubmission(form);

    const data = new FormData(form);
    expect(data.get("name")).toBe("Alice");
    expect(data.get("email")).toBe("a@example.com");
    expect(data.get("start_date")).toBe("7 May 2026");
  });
});
