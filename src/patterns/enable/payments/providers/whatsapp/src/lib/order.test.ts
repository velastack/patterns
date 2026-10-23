import { describe, expect, it, vi } from 'vitest';
import { openChat, recordOrder, whatsappHref } from '@velastack/whatsapp';
import { orderMessage, placeOrder } from './order.js';

const NUMBER = '+52 55 1234 5678';
const FORM = 'https://velastack.dev/v1/projects/test/forms/order';

vi.mock('$app/env', () => ({ browser: true }));
// The currency store reads the page's language from the document stubbed below.
vi.mock('$app/env/public', () => ({
	PUBLIC_WHATSAPP_NUMBER: NUMBER,
	PUBLIC_WHATSAPP_ORDER_FORM: FORM
}));
vi.mock('#lib/site.js', () => ({
	site: { name: 'Test', url: 'http://localhost:5173', currency: 'MXN' }
}));
vi.mock('@velastack/whatsapp', async (importOriginal) => ({
	...(await importOriginal<typeof import('@velastack/whatsapp')>()),
	openChat: vi.fn(() => true),
	recordOrder: vi.fn(() => Promise.resolve(new Response(null, { status: 200 })))
}));

// Prices follow the page's language, not the test runner's: on a Mexican
// Spanish page MXN reads as `$`.
vi.stubGlobal('document', { documentElement: { lang: 'es-MX' } });

const order = {
	ref: 'A7K-3Q2',
	name: 'Ana',
	phone: '+52 55 8765 4321',
	currency: 'MXN',
	lines: [{ name: 'Concha', quantity: 2, price: 12 }],
	subtotal: 24
};

describe('orderMessage', () => {
	it('writes the lines, the total and the customer in the business currency', () => {
		const message = orderMessage(order);
		expect(message).toContain('(A7K-3Q2)');
		expect(message).toContain('2 × Concha · $24.00');
		expect(message).toContain('Total: $24.00');
		expect(message).toContain('Name: Ana');
		expect(message).toContain('Phone: +52 55 8765 4321');
	});
});

describe('placeOrder', () => {
	it('records the order and opens the chat before anything is awaited', () => {
		const href = placeOrder(order, { token: 'tok', gotcha: '' });

		// Both happen inside the call, with no await in between: a chat opened
		// after an await has lost the click's user activation and is blocked.
		expect(href).toBe(whatsappHref(NUMBER, orderMessage(order)));
		expect(recordOrder).toHaveBeenCalledWith(FORM, order, {
			message: orderMessage(order),
			token: 'tok',
			gotcha: ''
		});
		expect(openChat).toHaveBeenCalledWith(href);
		expect(vi.mocked(recordOrder).mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(openChat).mock.invocationCallOrder[0]
		);
	});
});
