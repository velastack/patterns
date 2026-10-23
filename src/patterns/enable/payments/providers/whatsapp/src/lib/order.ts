import { browser } from '$app/env';
import { PUBLIC_WHATSAPP_NUMBER, PUBLIC_WHATSAPP_ORDER_FORM } from '$app/env/public';
import {
	formatLines,
	formatMoney,
	openChat,
	recordOrder,
	whatsappHref,
	type Order
} from '@velastack/whatsapp';
import { site } from '#lib/site.js';

/** The hosted VelaStack form each order is recorded to. Empty records nothing. */
export const ORDER_FORM = PUBLIC_WHATSAPP_ORDER_FORM;

/**
 * The page's language, so a price reads the way the page does (an English
 * page shows MXN as `MX$5.50`, a Spanish one as `$5.50`) rather than the way
 * the visitor's browser is set.
 */
function pageLocale(): string | undefined {
	return (browser && document.documentElement.lang) || undefined;
}

/** A price in the business's currency (`site.currency`), formatted for the page. */
export function formatPrice(amount: number): string {
	return formatMoney(amount, site.currency, pageLocale());
}

/**
 * The message the customer sends the business. It is yours to change: this
 * is what lands in the business's WhatsApp.
 */
export function orderMessage(order: Order): string {
	const lines = [
		`Hi! I'd like to place an order (${order.ref}):`,
		'',
		formatLines(order.lines, order.currency, pageLocale())
	];
	if (order.subtotal !== undefined) lines.push('', `Total: ${formatPrice(order.subtotal)}`);
	lines.push('', `Name: ${order.name}`, `Phone: ${order.phone}`);
	if (order.note) lines.push(`Note: ${order.note}`);
	return lines.join('\n');
}

/**
 * Records the order and opens the chat with the business. Call it straight
 * from the submit handler: the chat has to open before anything is awaited,
 * or the browser blocks it. Returns the chat link, or `null` when
 * `PUBLIC_WHATSAPP_NUMBER` is not set.
 */
export function placeOrder(
	order: Order,
	form: { token: string | null; gotcha: string }
): string | null {
	const message = orderMessage(order);
	const href = whatsappHref(PUBLIC_WHATSAPP_NUMBER, message);
	if (!href) return null;
	if (ORDER_FORM) {
		recordOrder(ORDER_FORM, order, { message, ...form }).catch((error) => {
			console.error('Recording the order failed:', error);
		});
	}
	openChat(href);
	return href;
}
