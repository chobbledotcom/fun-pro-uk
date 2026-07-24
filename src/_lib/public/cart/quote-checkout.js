// Quote checkout page
// Populates form with cart items and displays summary

import {
  calculateDays,
  initHireCalculator,
} from "#public/cart/hire-calculator.js";
import { getCart } from "#public/utils/cart-utils.js";
import {
  buildDeliveryText,
  formatDeliveryPrice,
  getSelectedDelivery,
} from "#public/utils/delivery-pricing.js";
import { onReady } from "#public/utils/on-ready.js";
import {
  buildCartText,
  getDisplayPrice,
  sanitizeItemName,
} from "#public/utils/quote-checkout-pricing.js";
import {
  setupDetailsBlurHandlers,
  updateQuotePrice,
} from "#public/utils/quote-price-utils.js";
import { IDS } from "#public/utils/selectors.js";
import { getTemplate } from "#public/utils/template.js";

const renderCheckoutItem = (item, days) => {
  const template = getTemplate(IDS.QUOTE_CHECKOUT_ITEM, document);

  template.querySelector('[data-field="name"]').textContent =
    sanitizeItemName(item);
  template.querySelector('[data-field="qty"]').textContent =
    `x${item.quantity}`;
  template.querySelector('[data-field="price"]').textContent = getDisplayPrice(
    item,
    days,
  );

  return template;
};

const renderDeliveryItem = (delivery) => {
  const template = getTemplate(IDS.QUOTE_CHECKOUT_ITEM, document);

  template.querySelector('[data-field="name"]').textContent =
    `Delivery to ${delivery.name}`;
  template.querySelector('[data-field="qty"]').textContent = "";
  template.querySelector('[data-field="price"]').textContent =
    formatDeliveryPrice(delivery.price);

  return template;
};

const populateForm = (days) => {
  const cart = getCart();
  const cartItemsField = document.getElementById("cart-items");
  const deliveryChargeField = document.getElementById("delivery-charge");
  const summaryEl = document.getElementById("cart-summary");

  if (!cartItemsField || !deliveryChargeField || !summaryEl) return;

  const itemsEl = summaryEl.querySelector(".quote-checkout-items");

  if (cart.length === 0) {
    window.location.href = "/quote/";
    return;
  }

  const delivery = getSelectedDelivery(days);
  const cartLines = cart.map((item) => buildCartText(item, days));
  const summaryItems = cart.map((item) => renderCheckoutItem(item, days));
  if (delivery !== null) {
    cartLines.push(buildDeliveryText(delivery));
    summaryItems.push(renderDeliveryItem(delivery));
  }

  cartItemsField.value = cartLines.join("\n");
  deliveryChargeField.value =
    delivery === null ? "" : formatDeliveryPrice(delivery.price);

  itemsEl.replaceChildren(...summaryItems);
};

// Calculate days from date inputs (returns 1 if dates not set)
const getDays = () => {
  const start = document.querySelector('input[name="start_date"]')?.value;
  const end = document.querySelector('input[name="end_date"]')?.value;
  return start && end ? calculateDays(start, end) : 1;
};

const init = () => {
  const updateQuoteSummary = (days) => {
    populateForm(days);
    updateQuotePrice(days);
  };
  updateQuoteSummary(getDays());
  initHireCalculator(updateQuoteSummary);
  setupDetailsBlurHandlers(getDays);

  const deliveryArea = document.querySelector('select[name="delivery_area"]');
  if (deliveryArea !== null) {
    deliveryArea.addEventListener("change", () => populateForm(getDays()));
  }
};

onReady(init);
