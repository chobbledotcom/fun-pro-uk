import { formatPrice } from "#public/utils/cart-utils.js";

const DELIVERY_AREA_SELECTOR = 'select[name="delivery_area"]';

const getDeliveryPriceForDays = (days, option) => {
  const priceValue =
    days > 1 ? option.dataset.multipleDayPrice : option.dataset.sameDayPrice;
  const price = Number(priceValue);

  if (priceValue === undefined || !Number.isFinite(price)) {
    throw new Error(`Delivery price is missing for ${option.value}`);
  }

  return price;
};

const getSelectedDelivery = (days, root = document) => {
  const select = root.querySelector(DELIVERY_AREA_SELECTOR);
  if (select === null || select.value === "") return null;

  const option = [...select.options].find(
    (candidate) => candidate.value === select.value,
  );
  if (!option)
    throw new Error(`Delivery area option not found: ${select.value}`);

  return {
    name: option.value,
    price: getDeliveryPriceForDays(days, option),
  };
};

const formatDeliveryPrice = (price) =>
  price === 0 ? "FREE" : formatPrice(price);

const buildDeliveryText = (delivery) =>
  `Delivery to ${delivery.name} = ${formatDeliveryPrice(delivery.price)}`;

export {
  buildDeliveryText,
  formatDeliveryPrice,
  getDeliveryPriceForDays,
  getSelectedDelivery,
};
