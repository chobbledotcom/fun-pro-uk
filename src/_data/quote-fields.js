import { processQuoteFields } from "#config/quote-fields-helpers.js";
import deliveryAreas from "./delivery-areas.json" with { type: "json" };
import quoteFieldsData from "./quote-fields.json" with { type: "json" };

const deliveryOptions = deliveryAreas.areas.map((area) => ({
  value: area.name,
  label: `${area.name} - ${area.distance}`,
  sameDayPrice: area.sameDayPrice,
  multipleDayPrice: area.multipleDayPrice,
}));

const fieldsWithDeliveryAreas = quoteFieldsData.sections.map((section) => ({
  ...section,
  fields: section.fields.map((field) =>
    field.name === "delivery_area"
      ? { ...field, options: deliveryOptions }
      : field,
  ),
}));

const quoteFields = processQuoteFields({
  ...quoteFieldsData,
  sections: fieldsWithDeliveryAreas,
});

export default function () {
  return quoteFields;
}
