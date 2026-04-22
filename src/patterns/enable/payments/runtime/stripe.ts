import Stripe from "stripe";
import type PocketBase from "pocketbase";
import type { Logger } from "../../../../core/logger";

export interface StripeTestFixture {
  product: Stripe.Product;
  price: Stripe.Price;
  existing: boolean;
}

export interface SyncUsersResult {
  total: number;
  linked: number;
  created: number;
  reused: number;
  skipped: number;
}

export async function syncUsersToStripeCustomers(
  pb: PocketBase,
  stripeSecretKey: string,
  logger: Logger,
): Promise<SyncUsersResult> {
  const stripe = new Stripe(stripeSecretKey);
  const users = await pb
    .collection("users")
    .getFullList<{ id: string; email: string }>();

  const existing = await pb
    .collection("stripe_customers")
    .getFullList<{ id: string; user: string }>();
  const linkedUserIds = new Set(existing.map((c) => c.user));

  const result: SyncUsersResult = {
    total: users.length,
    linked: linkedUserIds.size,
    created: 0,
    reused: 0,
    skipped: 0,
  };

  for (const user of users) {
    if (linkedUserIds.has(user.id)) {
      result.skipped += 1;
      continue;
    }

    if (!user.email) {
      logger.info(`Skipping user ${user.id} with no email`);
      result.skipped += 1;
      continue;
    }

    const matching = await stripe.customers.list({
      email: user.email,
      limit: 1,
      expand: ["data.invoice_settings"],
    });

    let customer: Stripe.Customer;
    let isExistingCustomer = false;

    if (matching.data.length > 0) {
      customer = matching.data[0];
      isExistingCustomer = true;
      result.reused += 1;
      logger.info(`Reusing Stripe customer ${customer.id} for ${user.email}`);
    } else {
      customer = await stripe.customers.create({ email: user.email });
      result.created += 1;
      logger.info(`Created Stripe customer ${customer.id} for ${user.email}`);
    }

    try {
      await pb.collection("stripe_customers").create({
        id: customer.id,
        user: user.id,
      });
    } catch (error) {
      logger.info(
        `Failed to create stripe_customers row for ${user.email}: ${(error as Error).message}`,
      );
      continue;
    }

    if (!isExistingCustomer) {
      continue;
    }

    const paymentMethods = await stripe.customers.listPaymentMethods(
      customer.id,
      { type: "card", allow_redisplay: "always" },
    );

    for (const paymentMethod of paymentMethods.data) {
      if (paymentMethod.allow_redisplay === "unspecified") continue;
      try {
        await pb.collection("stripe_payment_methods").create({
          id: paymentMethod.id,
          customer: customer.id,
          brand: paymentMethod.card?.brand,
          last4: paymentMethod.card?.last4,
          exp_month: paymentMethod.card?.exp_month,
          exp_year: paymentMethod.card?.exp_year,
        });
      } catch {}
    }

    const defaultPaymentMethod =
      customer.invoice_settings?.default_payment_method;
    if (defaultPaymentMethod) {
      try {
        await pb.collection("stripe_customers").update(customer.id, {
          default_payment_method:
            typeof defaultPaymentMethod === "string"
              ? defaultPaymentMethod
              : defaultPaymentMethod.id,
        });
      } catch {}
    }
  }

  return result;
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

export async function getProductAndPriceById(
  stripeSecretKey: string,
  priceId: string,
): Promise<StripeTestFixture> {
  const stripe = new Stripe(stripeSecretKey);
  const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
  const product =
    typeof price.product === "string"
      ? await stripe.products.retrieve(price.product)
      : (price.product as Stripe.Product);
  price.product = product.id;
  return { product, price, existing: true };
}
