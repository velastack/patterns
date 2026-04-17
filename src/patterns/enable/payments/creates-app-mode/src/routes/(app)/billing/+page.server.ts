import { error } from "@sveltejs/kit";
import stripe from "$lib/stripe";

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
  };
};

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
};
