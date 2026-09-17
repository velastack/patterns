import Stripe from 'stripe';
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import stripe from '$lib/stripe';
import { handleStripeEvent } from '$lib/workflows/stripe-event';

async function verifyWebhookSignature(request: Request, webhookSecret: string): Promise<Stripe.Event> {
	const body = await request.text();
	const signature = request.headers.get('stripe-signature');

	if (!signature) {
		throw new Error('Missing stripe-signature header');
	}

	if (!webhookSecret) {
		throw new Error('Missing webhook secret');
	}

	try {
		return stripe.webhooks.constructEvent(body, signature, webhookSecret);
	} catch (err) {
		console.error('Webhook signature verification failed:', err);
		throw new Error('Invalid signature');
	}
}

export const POST = async ({ request }) => {
	try {
		const event = await verifyWebhookSignature(request, env.STRIPE_WEBHOOK_SECRET);

		// Queued, not handled here: the workflow runs the handler with retries,
		// and its idempotency key means a redelivery of the same event returns
		// the existing run instead of handling it twice.
		const handle = await handleStripeEvent.run(event, { idempotencyKey: event.id });
		console.log(`Queued webhook event ${event.type} (${event.id}) as run ${handle.workflowRun.id}`);

		return json({
			received: true,
			eventId: event.id,
			eventType: event.type,
			runId: handle.workflowRun.id
		});
	} catch (error) {
		console.error('Webhook processing error:', error);

		return json(
			{
				error: 'Webhook processing failed',
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 400 }
		);
	}
};
