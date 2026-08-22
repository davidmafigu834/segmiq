import type { QuotationLineItemInput } from "@/types";

/** Starter catalogue for the built-in Residential Premium Solar template. Not customer data. */
export const SOLAR_BUILTIN_STARTER_ITEMS: QuotationLineItemInput[] = [
  {
    item_name: "550W Mono PERC Modules",
    description: "High-efficiency rooftop array",
    sku: "JA Solar JAM72S30",
    quantity: 12,
    unit: "Pcs",
    unit_price: 185,
    group_label: "Equipment",
  },
  {
    item_name: "Hybrid Inverter 5kW",
    sku: "Deye SUN-5K-SG",
    quantity: 1,
    unit: "Each",
    unit_price: 980,
    group_label: "Equipment",
  },
  {
    item_name: "Lithium Battery 5.12kWh",
    sku: "Dyness 5.12",
    quantity: 1,
    unit: "Each",
    unit_price: 1420,
    group_label: "Equipment",
  },
  {
    item_name: "Roof mounting kit",
    quantity: 1,
    unit: "Each",
    unit_price: 340,
    group_label: "Equipment",
  },
  {
    item_name: "DC/AC cabling & protection",
    quantity: 1,
    unit: "Each",
    unit_price: 260,
    group_label: "Equipment",
  },
  {
    item_name: "Design & engineering",
    quantity: 1,
    unit: "Lot",
    unit_price: 220,
    group_label: "Installation",
  },
  {
    item_name: "Install, test & commission",
    quantity: 1,
    unit: "Lot",
    unit_price: 890,
    group_label: "Installation",
  },
];

export const SOLAR_BUILTIN_TERMS =
  "Prices are valid until the date shown. Manufacturer warranties apply at handover.";

export const SOLAR_BUILTIN_PAYMENT_LABEL =
  "Advance 10% with order, 60% before installation, 30% after commissioning";

export const SOLAR_BUILTIN_WARRANTY =
  "PV modules and inverter per manufacturer warranty. Workmanship 2 years.";
