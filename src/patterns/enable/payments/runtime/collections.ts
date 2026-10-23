import type { CollectionSpec } from "../../../../core/types";

const users = "users";
const stripeCustomers = "stripe_customers";
const stripePaymentMethods = "stripe_payment_methods";

/**
 * The Stripe catalog as `sync-stripe-catalog.ts` copies it: the fields the
 * payment and billing pages read, plus what a store page shows (description,
 * images, metadata, the product URL, a price's nickname and lookup key).
 * `setupStripe` creates these and adds any field an older project's
 * collection lacks.
 */
export const STRIPE_PRODUCTS: CollectionSpec = {
  name: "stripe_products",
  type: "base",
  fields: [
    {
      name: "id",
      pattern: "^[a-zA-Z0-9_]+$",
      primaryKey: true,
      required: true,
      system: true,
      type: "text",
    },
    { name: "name", required: false, type: "text" },
    { name: "active", required: false, type: "text" },
    { name: "default_price", required: false, type: "text" },
    { name: "description", required: false, type: "text" },
    // Stripe's list of image URLs, and its free-form key/value metadata.
    { name: "images", required: false, type: "json" },
    { name: "metadata", required: false, type: "json" },
    { name: "url", required: false, type: "text" },
    { name: "created", onCreate: true, onUpdate: false, type: "autodate" },
    { name: "updated", onCreate: true, onUpdate: true, type: "autodate" },
  ],
};

export const STRIPE_PRICES: CollectionSpec = {
  name: "stripe_prices",
  type: "base",
  fields: [
    {
      name: "id",
      pattern: "^[a-zA-Z0-9_]+$",
      primaryKey: true,
      required: true,
      system: true,
      type: "text",
    },
    { name: "billing_scheme", required: false, type: "text" },
    { name: "currency", required: false, type: "text" },
    { name: "product", required: false, type: "text" },
    { name: "recurring", required: false, type: "json" },
    { name: "type", required: false, type: "text" },
    { name: "unit_amount", required: false, type: "number" },
    { name: "active", required: false, type: "bool" },
    { name: "nickname", required: false, type: "text" },
    { name: "lookup_key", required: false, type: "text" },
    { name: "created", onCreate: true, onUpdate: false, type: "autodate" },
    { name: "updated", onCreate: true, onUpdate: true, type: "autodate" },
  ],
};

const stripeCustomersCollection: CollectionSpec = {
  name: stripeCustomers,
  type: "base",
  fields: [
    {
      name: "id",
      pattern: "^[a-zA-Z0-9_]+$",
      primaryKey: true,
      required: true,
      type: "text",
    },
    {
      collectionId: users,
      maxSelect: 1,
      minSelect: 0,
      name: "user",
      required: true,
      type: "relation",
    },
    {
      collectionId: stripePaymentMethods,
      maxSelect: 1,
      minSelect: 0,
      name: "default_payment_method",
      required: false,
      type: "relation",
    },
    { name: "created", onCreate: true, onUpdate: false, type: "autodate" },
    { name: "updated", onCreate: true, onUpdate: true, type: "autodate" },
  ],
};

const stripePaymentMethodsCollection: CollectionSpec = {
  name: stripePaymentMethods,
  type: "base",
  fields: [
    {
      name: "id",
      pattern: "^[a-zA-Z0-9_]+$",
      primaryKey: true,
      required: true,
      type: "text",
    },
    { name: "brand", required: true, type: "text" },
    { name: "last4", required: true, type: "text" },
    { name: "exp_month", required: true, type: "number" },
    { name: "exp_year", required: true, type: "number" },
    {
      collectionId: stripeCustomers,
      maxSelect: 1,
      minSelect: 0,
      name: "customer",
      required: true,
      type: "relation",
      cascadeDelete: true,
    },
    { name: "created", onCreate: true, onUpdate: false, type: "autodate" },
    { name: "updated", onCreate: true, onUpdate: true, type: "autodate" },
  ],
};

const transactions: CollectionSpec = {
  name: "transactions",
  type: "base",
  fields: [
    {
      autogeneratePattern: "[a-z0-9]{15}",
      max: 15,
      min: 15,
      name: "id",
      pattern: "^[a-z0-9]+$",
      primaryKey: true,
      required: true,
      type: "text",
    },
    { name: "stripe_payment_intent", required: true, type: "text" },
    { name: "amount", required: true, type: "number" },
    { name: "currency", required: true, type: "text" },
    { name: "last4", required: true, type: "text" },
    { name: "brand", required: true, type: "text" },
    { name: "created", required: true, type: "date" },
    { name: "stripe_charge", required: true, type: "text" },
    { name: "stripe_customer", required: true, type: "text" },
    {
      collectionId: users,
      maxSelect: 1,
      minSelect: 0,
      name: "user",
      required: true,
      type: "relation",
    },
    { name: "receipt_url", required: true, type: "url" },
  ],
};

export const PAYMENTS_BASE_COLLECTIONS: CollectionSpec[] = [
  STRIPE_PRODUCTS,
  STRIPE_PRICES,
];

export const PAYMENTS_APP_MODE_COLLECTIONS: CollectionSpec[] = [
  stripeCustomersCollection,
  stripePaymentMethodsCollection,
  transactions,
];
