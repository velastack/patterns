# Billing Page - Stripe Payment Methods

This billing page provides a modern UI for managing payment methods with Stripe.

## Features

✅ **Display Payment Methods** - Shows all saved cards with brand, last 4 digits, and expiration
✅ **Add Payment Methods** - Secure card input using Stripe Elements
✅ **Remove Payment Methods** - Delete cards with confirmation dialog
✅ **Default Payment Method** - Set and display the default payment method
✅ **Responsive Design** - Mobile-friendly layout
✅ **Error Handling** - Toast notifications for user feedback

## Current Status

The frontend is **fully functional** with mock data. To connect to your backend, follow the integration steps below.

## Backend Integration

### 1. Update Stripe Publishable Key

In `+page.svelte`, replace the placeholder with your actual Stripe publishable key:

```typescript
const STRIPE_PUBLISHABLE_KEY = "pk_test_YOUR_KEY_HERE";
```

Or better yet, load it from environment variables:

```typescript
import { env } from "$env/dynamic/public";
const STRIPE_PUBLISHABLE_KEY = env.PUBLIC_STRIPE_PUBLISHABLE_KEY;
```

### 2. Fetch Payment Methods on Load

Update `+page.server.ts` to fetch payment methods:

```typescript
export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user;

  if (!user?.stripeCustomerId) {
    return { paymentMethods: [] };
  }

  // Fetch payment methods from Stripe
  const stripe = await import("$lib/stripe").then((m) => m.default);
  const paymentMethods = await stripe.paymentMethods.list({
    customer: user.stripeCustomerId,
    type: "card",
  });

  return {
    paymentMethods: paymentMethods.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand || "unknown",
      last4: pm.card?.last4 || "0000",
      expMonth: pm.card?.exp_month || 1,
      expYear: pm.card?.exp_year || 2025,
      isDefault: false, // You'll need to track this separately
    })),
  };
};
```

### 3. Create API Endpoints

Create the following server endpoints:

#### Add Payment Method: `+page.server.ts`

```typescript
export const actions = {
  addPaymentMethod: async ({ request, locals }) => {
    const formData = await request.formData();
    const paymentMethodId = formData.get("paymentMethodId");

    // Attach payment method to customer
    const stripe = await import("$lib/stripe").then((m) => m.default);
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: locals.user.stripeCustomerId,
    });

    return { success: true };
  },

  removePaymentMethod: async ({ request, locals }) => {
    const formData = await request.formData();
    const paymentMethodId = formData.get("paymentMethodId");

    // Detach payment method from customer
    const stripe = await import("$lib/stripe").then((m) => m.default);
    await stripe.paymentMethods.detach(paymentMethodId);

    return { success: true };
  },

  setDefaultPaymentMethod: async ({ request, locals }) => {
    const formData = await request.formData();
    const paymentMethodId = formData.get("paymentMethodId");

    // Update customer's default payment method
    const stripe = await import("$lib/stripe").then((m) => m.default);
    await stripe.customers.update(locals.user.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    return { success: true };
  },
};
```

### 4. Update Frontend to Use Actions

Replace the mock functions in `+page.svelte`:

```typescript
async function handleAddPaymentMethod() {
  if (!stripe || !cardElement || !cardComplete) return;

  isProcessing = true;

  try {
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: "card",
      card: cardElement,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    // Submit to your backend
    const formData = new FormData();
    formData.append("paymentMethodId", paymentMethod.id);

    const response = await fetch("?/addPaymentMethod", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      toast.success("Payment method added");
      // Reload page to fetch updated payment methods
      window.location.reload();
    }
  } finally {
    isProcessing = false;
  }
}
```

## Security Considerations

⚠️ **Important**: Never expose your Stripe secret key on the frontend
✅ All sensitive operations should happen on your backend
✅ Use Stripe's publishable key for frontend operations
✅ Validate user permissions before modifying payment methods
✅ Use HTTPS in production

## Testing

Use [Stripe's test cards](https://stripe.com/docs/testing) for testing:

- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **Requires authentication**: 4000 0025 0000 3155

Use any future expiration date and any 3-digit CVC.

## Styling

The page uses Tailwind CSS and shadcn/ui components. All components are styled to match your existing design system with support for light/dark modes.

### Stripe Elements Styling

Since Stripe Elements render in an iframe, they cannot access CSS variables directly. Additionally, Stripe only accepts HEX, RGB, or HSL colors (not modern formats like OKLCH).

The implementation:

1. **Creates temporary DOM elements** with CSS variables applied
2. **Lets the browser compute colors** - converts OKLCH/HSL/any format to RGB
3. **Extracts RGB values** that Stripe Elements can understand
4. **Passes computed colors** to Stripe Elements on initialization
5. **Matches the current theme** automatically (light/dark mode)

This approach works with any CSS color format (oklch, hsl, rgb, hex) and ensures Stripe Elements always match your theme when the "Add Payment Method" dialog opens.

## Dependencies

- `@stripe/stripe-js` - Stripe.js for frontend
- `stripe` - Stripe Node.js SDK for backend
- `svelte-sonner` - Toast notifications
- `@lucide/svelte` - Icons
- shadcn/ui components
