import { browser } from '$app/env';
import { currency } from '#lib/currency.svelte.js';

export interface CartItem {
	/** The Stripe price (`price_...`). */
	price: string;
	name: string;
	/** Stripe's `unit_amount`: the price in the currency's smallest unit. */
	unitAmount: number;
	currency: string;
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

/**
 * Formats a Stripe amount: Intl knows how many decimals the currency has
 * (none for JPY). Shown the way the visitor reads prices: in the currency they
 * picked, as an estimate, when it isn't the price's own.
 */
export function formatAmount(amount: number, code: string): string {
	const digits =
		new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions()
			.maximumFractionDigits ?? 2;
	return currency.format(amount / 10 ** digits, code);
}
