import { describe, expect, test } from "bun:test";
import {
  buildDeliveryText,
  formatDeliveryPrice,
  getSelectedDelivery,
} from "#public/utils/delivery-pricing.js";

const setupDeliveryArea = ({
  value = "Banbury",
  sameDayPrice = 60,
  multipleDayPrice = 120,
} = {}) => {
  document.body.innerHTML = `
    <script id="site-config" type="application/json">{"currency":"GBP"}</script>
    <select name="delivery_area">
      <option value="">Select an option</option>
      <option
        value="${value}"
        data-same-day-price="${sameDayPrice}"
        data-multiple-day-price="${multipleDayPrice}"
        selected
      >${value}</option>
    </select>
  `;
};

describe("delivery-pricing", () => {
  test("uses the same-day price for a one-day event", () => {
    setupDeliveryArea();
    expect(getSelectedDelivery(1)).toEqual({ name: "Banbury", price: 60 });
  });

  test("uses the multiple-day price for events longer than one day", () => {
    setupDeliveryArea();
    expect(getSelectedDelivery(2)).toEqual({ name: "Banbury", price: 120 });
  });

  test("returns no delivery until an area is selected", () => {
    document.body.innerHTML = `
      <select name="delivery_area">
        <option value="" selected>Select an option</option>
      </select>
    `;
    expect(getSelectedDelivery(1)).toBeNull();
  });

  test("formats and submits a free delivery charge", () => {
    setupDeliveryArea({
      value: "Rugby",
      sameDayPrice: 0,
      multipleDayPrice: 0,
    });
    const delivery = getSelectedDelivery(1);

    expect(formatDeliveryPrice(delivery.price)).toBe("FREE");
    expect(buildDeliveryText(delivery)).toBe("Delivery to Rugby = FREE");
  });

  test("fails when a selected area has no price", () => {
    document.body.innerHTML = `
      <select name="delivery_area">
        <option value="Unknown" selected>Unknown</option>
      </select>
    `;
    expect(() => getSelectedDelivery(1)).toThrow(
      "Delivery price is missing for Unknown",
    );
  });
});
