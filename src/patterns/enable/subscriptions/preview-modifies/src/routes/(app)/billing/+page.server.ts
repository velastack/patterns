import { error } from "@sveltejs/kit";
import stripe from "$lib/stripe";

type RecurringInfo = {
  interval: string;
  interval_count: number;
  trial_period_days?: number | null;
};

function parseRecurring(value: unknown): RecurringInfo | null {
  if (!value) return null;
  if (typeof value === "object") return value as RecurringInfo;
  try {
    return JSON.parse(value as string) as RecurringInfo;
  } catch {
    return null;
  }
}

const ACTIVE_SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "incomplete",
];

export const load = async ({ locals, depends, parent }) => {
  const { user } = await parent();
  const customer = await locals.admin
    .collection("stripe_customers")
    .getFirstListItem(locals.admin.filter("user = {:user}", { user: user.id }));

  if (!customer || !customer.id) {
    return error(400, "Customer not found");
  }

  const stripeCustomer = await stripe.customers.retrieve(customer.id);
  if (stripeCustomer.deleted) {
    return error(400, "Customer not found");
  }

  const paymentMethods = await stripe.customers.listPaymentMethods(
    customer.id,
    {
      type: "card",
      allow_redisplay: "always",
    },
  );

  const subscriptionRecords = await locals.admin
    .collection("stripe_subscriptions")
    .getFullList({
      filter: locals.admin.filter("user = {:user}", { user: user.id }),
      expand: "price",
      sort: "-created",
    });

  const recurringPrices = await locals.admin
    .collection("stripe_prices")
    .getFullList({
      filter: locals.admin.filter("type = {:type} && active = true", {
        type: "recurring",
      }),
    });

  const productIds: string[] = Array.from(
    new Set(
      recurringPrices
        .map((p) => p.product)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const productMap = new Map<string, string>();
  if (productIds.length > 0) {
    const products = await locals.admin
      .collection("stripe_products")
      .getFullList({
        filter: productIds.map((id) => `id = "${id}"`).join(" || "),
      });
    for (const product of products) {
      productMap.set(product.id, product.name ?? product.id);
    }
  }

  const availablePlans = recurringPrices.map((price) => ({
    id: price.id,
    productName:
      (price.product && productMap.get(price.product)) ?? price.product ?? "",
    unitAmount: (price.unit_amount ?? 0) as number,
    currency: (price.currency ?? "") as string,
    recurring: parseRecurring(price.recurring),
  }));

  const subscriptions = subscriptionRecords.map((sub) => {
    const expanded = sub.expand?.price;
    return {
      id: sub.id,
      status: sub.status as string,
      currentPeriodStart: (sub.current_period_start as string | null) ?? null,
      currentPeriodEnd: (sub.current_period_end as string | null) ?? null,
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      canceledAt: (sub.canceled_at as string | null) || null,
      priceId: sub.price as string,
      productName: expanded
        ? ((expanded.product && productMap.get(expanded.product)) ??
          expanded.product ??
          null)
        : null,
      unitAmount: expanded ? ((expanded.unit_amount ?? null) as number | null) : null,
      currency: expanded ? ((expanded.currency ?? null) as string | null) : null,
      recurring: expanded ? parseRecurring(expanded.recurring) : null,
    };
  });

  const activeSubscription =
    subscriptions.find((s) => ACTIVE_SUBSCRIPTION_STATUSES.includes(s.status)) ||
    null;

  // If the active plan isn't in the list (e.g., price was deactivated), include
  // it so it can still be shown as the current plan.
  if (
    activeSubscription &&
    !availablePlans.some((p) => p.id === activeSubscription.priceId)
  ) {
    availablePlans.push({
      id: activeSubscription.priceId,
      productName: activeSubscription.productName ?? "",
      unitAmount: activeSubscription.unitAmount ?? 0,
      currency: activeSubscription.currency ?? "",
      recurring: activeSubscription.recurring,
    });
  }

  availablePlans.sort((a, b) => a.unitAmount - b.unitAmount);

  depends("app:billing");

  return {
    paymentMethods: paymentMethods.data.map((pm) => ({
      id: pm.id,
      brand: pm.card!.brand,
      last4: pm.card!.last4,
      expMonth: pm.card!.exp_month,
      expYear: pm.card!.exp_year,
      isDefault: pm.id === customer.default_payment_method,
    })),
    user,
    hasDefaultPaymentMethod: Boolean(customer.default_payment_method),
    activeSubscription,
    availablePlans,
  };
};

async function getUserCustomer(locals: App.Locals) {
  const userId = locals.pb.authStore.record?.id;
  if (!userId) {
    return error(401, "Unauthorized");
  }
  const customer = await locals.admin
    .collection("stripe_customers")
    .getFirstListItem(`user.id = "${userId}"`);
  if (!customer || !customer.id) {
    return error(400, "Customer not found");
  }
  return customer;
}

// A subscription can be updated in-place unless it has fully terminated.
const UPDATABLE_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "incomplete",
  "paused",
];

async function findUpdatableSubscription(
  locals: App.Locals,
  userId: string,
) {
  const filterClause = UPDATABLE_STATUSES.map(
    (s) => `status = "${s}"`,
  ).join(" || ");
  const subs = await locals.admin
    .collection("stripe_subscriptions")
    .getFullList({
      filter: locals.admin.filter(`user = {:user} && (${filterClause})`, {
        user: userId,
      }),
      sort: "-created",
    });
  return subs[0] ?? null;
}

export const actions = {
  setDefaultPaymentMethod: async ({ locals, request }) => {
    const formData = await request.formData();
    const paymentMethodId = formData.get("paymentMethodId") as string;

    const customer = await locals.admin
      .collection("stripe_customers")
      .getFirstListItem(`user.id = "${locals.pb.authStore.record?.id}"`);

    if (!customer || !customer.id) {
      return error(400, "Customer not found");
    }

    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    await locals.admin.collection("stripe_customers").update(customer.id, {
      default_payment_method: paymentMethodId,
    });
  },
  deletePaymentMethod: async ({ locals, request }) => {
    const formData = await request.formData();
    const paymentMethodId = formData.get("paymentMethodId") as string;

    const customer = await locals.admin
      .collection("stripe_customers")
      .getFirstListItem(`user.id = "${locals.pb.authStore.record?.id}"`);

    const defaultPaymentMethod = customer.default_payment_method;

    await stripe.paymentMethods.detach(paymentMethodId);

    // If default payment method was deleted, update default payment method
    if (defaultPaymentMethod === paymentMethodId) {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customer.id,
      });

      if (paymentMethods.data.length > 0) {
        const defaultPaymentMethod = paymentMethods.data[0];

        await stripe.customers.update(customer.id, {
          invoice_settings: {
            default_payment_method: defaultPaymentMethod.id,
          },
        });

        await locals.admin.collection("stripe_customers").update(customer.id, {
          default_payment_method: defaultPaymentMethod.id,
        });
      } else {
        await locals.admin.collection("stripe_customers").update(customer.id, {
          default_payment_method: null,
        });
      }
    }
  },
  selectPlan: async ({ locals, request }) => {
    const formData = await request.formData();
    const priceId = formData.get("priceId") as string;
    if (!priceId) return error(400, "Price ID is required");

    const userId = locals.pb.authStore.record?.id;
    if (!userId) return error(401, "Unauthorized");

    // If an updatable subscription already exists, change its price in place
    // rather than creating a duplicate. Covers switch, resume-to-different-plan,
    // and races where the webhook hasn't delivered the existing sub yet.
    const existing = await findUpdatableSubscription(locals, userId);
    if (existing) {
      const stripeSub = await stripe.subscriptions.retrieve(existing.id);
      const item = stripeSub.items.data[0];
      if (!item) return error(500, "Subscription has no items");

      await stripe.subscriptions.update(existing.id, {
        items: [{ id: item.id, price: priceId }],
        proration_behavior: "create_prorations",
        cancel_at_period_end: false,
      });
      return;
    }

    const customer = await getUserCustomer(locals);
    if (!customer.default_payment_method) {
      return error(400, "Add a default payment method before subscribing");
    }

    await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      default_payment_method: customer.default_payment_method,
      payment_behavior: "error_if_incomplete",
      off_session: true,
    });
  },
  cancelSubscription: async ({ locals, request }) => {
    const formData = await request.formData();
    const subscriptionId = formData.get("subscriptionId") as string;
    if (!subscriptionId) return error(400, "Subscription ID is required");

    const userId = locals.pb.authStore.record?.id;
    if (!userId) return error(401, "Unauthorized");

    // Verify the subscription belongs to this user before touching Stripe.
    try {
      const record = await locals.admin
        .collection("stripe_subscriptions")
        .getOne(subscriptionId);
      if (record.user !== userId) {
        return error(403, "Forbidden");
      }
    } catch {
      return error(404, "Subscription not found");
    }

    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  },
  resumeSubscription: async ({ locals, request }) => {
    const formData = await request.formData();
    const subscriptionId = formData.get("subscriptionId") as string;
    if (!subscriptionId) return error(400, "Subscription ID is required");

    const userId = locals.pb.authStore.record?.id;
    if (!userId) return error(401, "Unauthorized");

    try {
      const record = await locals.admin
        .collection("stripe_subscriptions")
        .getOne(subscriptionId);
      if (record.user !== userId) {
        return error(403, "Forbidden");
      }
    } catch {
      return error(404, "Subscription not found");
    }

    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  },
};
