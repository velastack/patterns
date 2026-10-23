import { browser } from '$app/env';
import { currency, money } from '#lib/currency.svelte.js';

export interface CartItem {
	/** The Stripe price (`price_...`). */
	price: string;
	name: string;
	/** Stripe's `unit_amount`: the price in the currency's smallest unit. */
	unitAmount: number;
	currency: string;
	/**
	 * Fixed amounts in other currencies, from the price's `currency_options` in
	 * the dashboard, by upper-cased code: `{ EUR: 1800 }`. A visitor reading
	 * prices in one of them sees and pays that amount, not an estimate.
	 */
	options?: Record<string, number>;
	quantity: number;
}

const STORAGE_KEY = 'cart';

/**
 * The cart is a list of Stripe prices kept in the browser. Stripe sees it only
 * at checkout, where it prices the session itself, so what is stored here is
 * for display and nothing in it can change what is charged.
 */
class Cart {
	items = $state<CartItem[]>([]);
	/** Whether the cart sheet is open. */
	open = $state(false);
	count = $derived(this.items.reduce((total, item) => total + item.quantity, 0));
	subtotal = $derived(
		this.items.reduce((total, item) => total + item.unitAmount * item.quantity, 0)
	);
	/** The cart's currency: Stripe refuses a mixed cart, so the first item's. `null` while empty. */
	currency = $derived<string | null>(this.items[0]?.currency ?? null);
	/** Fixed subtotals in the currencies every item has a dashboard amount in. */
	options = $derived.by<Record<string, number>>(() => {
		const [first, ...rest] = this.items;
		if (!first?.options) return {};
		const totals: Record<string, number> = {};
		for (const code of Object.keys(first.options)) {
			if (rest.every((item) => item.options?.[code] !== undefined)) {
				totals[code] = this.items.reduce(
					(total, item) => total + item.options![code] * item.quantity,
					0
				);
			}
		}
		return totals;
	});

	#loaded = false;

	/** Reads the saved cart, once, in the browser. */
	load() {
		if (!browser || this.#loaded) return;
		this.#loaded = true;
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
			if (Array.isArray(saved)) this.items = saved;
		} catch {
			// Unreadable or blocked storage starts an empty cart.
		}
	}

	add(item: Omit<CartItem, 'quantity'>, quantity = 1) {
		this.load();
		const line = this.items.find((line) => line.price === item.price);
		if (line) line.quantity += quantity;
		else this.items.push({ ...item, quantity });
		this.#save();
	}

	/** A quantity of 0 removes the item. */
	setQuantity(price: string, quantity: number) {
		if (quantity <= 0) return this.remove(price);
		const line = this.items.find((line) => line.price === price);
		if (!line) return;
		line.quantity = quantity;
		this.#save();
	}

	remove(price: string) {
		this.items = this.items.filter((line) => line.price !== price);
		this.#save();
	}

	clear() {
		this.items = [];
		this.#save();
	}

	#save() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify($state.snapshot(this.items)));
		} catch {
			// Storage can be full or blocked; the cart still works for this visit.
		}
	}
}

export const cart = new Cart();

/** Stripe amounts are in the currency's smallest unit; Intl knows how many digits that is (none for JPY). */
function major(amount: number, code: string): number {
	const digits =
		new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions()
			.maximumFractionDigits ?? 2;
	return amount / 10 ** digits;
}

/**
 * Formats a Stripe amount the way the visitor reads prices: the fixed amount
 * in the currency they picked when the dashboard set one (`options`), else
 * the price's own, converted and marked as an estimate when they picked another.
 */
export function formatAmount(amount: number, code: string, options?: Record<string, number>): string {
	const fixed = options?.[currency.current];
	if (fixed !== undefined && currency.current !== code) {
		return money(major(fixed, currency.current), currency.current);
	}
	return currency.format(major(amount, code), code);
}

/**
 * A synced price's `currency_options` as the cart keeps them: upper-cased
 * code to `unit_amount`, leaving out options priced another way (tiers, a
 * customer-chosen amount).
 */
export function priceOptions(raw: unknown): Record<string, number> | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const options: Record<string, number> = {};
	for (const [code, option] of Object.entries(raw as Record<string, { unit_amount?: unknown }>)) {
		if (typeof option?.unit_amount === 'number') options[code.toUpperCase()] = option.unit_amount;
	}
	return Object.keys(options).length > 0 ? options : undefined;
}
