import Stripe from "stripe";

export interface StripeTestFixture {
  product: Stripe.Product;
  price: Stripe.Price;
  existing: boolean;
}

export async function createTestProductAndPrice(
  stripeSecretKey: string,
): Promise<StripeTestFixture> {
  const stripe = new Stripe(stripeSecretKey);

  const products = await stripe.products.search({
    query: `name:"Test Product" AND metadata["test"]:"true"`,
    limit: 1,
  });

  if (products.data.length > 0) {
    const product = products.data[0];
    const prices = await stripe.prices.list({
      product: product.id,
      active: true,
      limit: 1,
    });
    if (prices.data.length > 0) {
      return { product, price: prices.data[0], existing: true };
    }
  }

  const product = await stripe.products.create({
    name: "Test Product",
    metadata: { test: "true" },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 1000,
    currency: "usd",
  });

  return { product, price, existing: false };
}
