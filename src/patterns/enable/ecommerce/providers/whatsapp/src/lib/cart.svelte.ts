import { browser } from '$app/env';
import { orderSubtotal, type OrderLine } from '@velastack/whatsapp';
import { site } from '#lib/site.js';

export interface CartItem extends OrderLine {
	/** Your own id for the item (a slug or SKU); lines with the same id merge. */
	id: string;
}

/** An order sent to WhatsApp, kept until the customer says they're done. */
export interface PlacedOrder {
	ref: string;
	/** The chat link, to open it again. */
	href: string;
}

const STORAGE_KEY = 'cart';

/**
 * The cart is a list of items kept in the browser. Checkout turns it into a
 * WhatsApp message to the business, where the order is confirmed and paid,
 * so what is stored here is what the customer asked for, not what they pay.
 */
class Cart {
	items = $state<CartItem[]>([]);
	/** Whether the cart sheet is open. */
	open = $state(false);
	placed = $state<PlacedOrder | null>(null);
	count = $derived(this.items.reduce((total, item) => total + item.quantity, 0));
	/** In `site.currency`, only when every item has a price; otherwise the business quotes. */
	subtotal = $derived(orderSubtotal(this.items, site.currency));

	#loaded = false;

	/** Reads the saved cart, once, in the browser. */
	load() {
		if (!browser || this.#loaded) return;
		this.#loaded = true;
		try {
			const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
			if (Array.isArray(saved?.items)) this.items = saved.items;
			if (saved?.placed) this.placed = saved.placed;
		} catch {
			// Unreadable or blocked storage starts an empty cart.
		}
	}

	add(item: Omit<CartItem, 'quantity'>, quantity = 1) {
		this.load();
		// Adding after an order was sent starts the next one.
		if (this.placed) this.clear();
		const line = this.items.find((line) => line.id === item.id);
		if (line) line.quantity += quantity;
		else this.items.push({ ...item, quantity });
		this.#save();
	}

	/** A quantity of 0 removes the item. */
	setQuantity(id: string, quantity: number) {
		if (quantity <= 0) return this.remove(id);
		const line = this.items.find((line) => line.id === id);
		if (!line) return;
		line.quantity = quantity;
		this.#save();
	}

	remove(id: string) {
		this.items = this.items.filter((line) => line.id !== id);
		this.#save();
	}

	/** Records that the order went to WhatsApp; the sheet shows it until `clear()`. */
	place(order: PlacedOrder) {
		this.placed = order;
		this.#save();
	}

	clear() {
		this.items = [];
		this.placed = null;
		this.#save();
	}

	#save() {
		try {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({ items: $state.snapshot(this.items), placed: this.placed })
			);
		} catch {
			// Storage can be full or blocked; the cart still works for this visit.
		}
	}
}

export const cart = new Cart();
