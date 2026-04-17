/// <reference path="../types.d.ts" />

cronAdd("stripe-products", "*/2 * * * *", () => {
  const utils = require(`${__hooks}/utils.js`);
  utils.triggerJob("/api/stripe/sync/products");
});

cronAdd("stripe-prices", "*/2 * * * *", () => {
  const utils = require(`${__hooks}/utils.js`);
  utils.triggerJob("/api/stripe/sync/prices");
});
