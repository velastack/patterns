import { browser } from '$app/env';
import { currency, money } from '#lib/currency.svelte.js';
import { marketCountry, storefront } from '#lib/shopify.js';

export interface Money {
	amount: string;
	currencyCode: string;
}

export interface CartLine {
	id: string;
	quantity: number;
	attributes: { key: string; value: string }[];
	cost: { totalAmount: Money };
	merchandise: {
		id: string;
		title: string;
		image: { url: string; altText: string | null } | null;
		price: Money;
		product: { title: string; handle: string };
	};
}

interface ShopifyCart {
	id: string;
	checkoutUrl: string;
	totalQuantity: number;
	cost: { subtotalAmount: Money };
	lines: { nodes: CartLine[] };
}

interface CartPayload {
	cart: ShopifyCart | null;
	userErrors: { message: string }[];
}

const CART_FRAGMENT = `#graphql
	fragment CartFields on Cart {
		id
		checkoutUrl
		totalQuantity
		cost {
			subtotalAmount {
				amount
				currencyCode
			}
		}
		lines(first: 100) {
			nodes {
				id
				quantity
				attributes {
					key
					value
				}
				cost {
					totalAmount {
						amount
						currencyCode
					}
				}
				merchandise {
					... on ProductVariant {
						id
						title
						image {
							url
							altText
						}
						price {
							amount
							currencyCode
						}
						product {
							title
							handle
						}
					}
				}
			}
		}
	}
`;

const CART_QUERY = `#graphql
	query Cart($id: ID!, $country: CountryCode) @inContext(country: $country) {
		cart(id: $id) {
			...CartFields
		}
	}
	${CART_FRAGMENT}
`;

const CART_CREATE = `#graphql
	mutation CartCreate($lines: [CartLineInput!]!, $country: CountryCode) @inContext(country: $country) {
		cartCreate(input: { lines: $lines, buyerIdentity: { countryCode: $country } }) {
			cart {
				...CartFields
			}
			userErrors {
				message
			}
		}
	}
	${CART_FRAGMENT}
`;

const CART_LINES_ADD = `#graphql
	mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!, $country: CountryCode)
	@inContext(country: $country) {
		cartLinesAdd(cartId: $cartId, lines: $lines) {
			cart {
				...CartFields
			}
			userErrors {
				message
			}
		}
	}
	${CART_FRAGMENT}
`;

const CART_LINES_UPDATE = `#graphql
	mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!, $country: CountryCode)
	@inContext(country: $country) {
		cartLinesUpdate(cartId: $cartId, lines: $lines) {
			cart {
				...CartFields
			}
			userErrors {
				message
			}
		}
	}
	${CART_FRAGMENT}
`;

const CART_LINES_REMOVE = `#graphql
	mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!, $country: CountryCode)
	@inContext(country: $country) {
		cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
			cart {
				...CartFields
			}
			userErrors {
				message
			}
		}
	}
	${CART_FRAGMENT}
`;

const CART_BUYER_IDENTITY_UPDATE = `#graphql
	mutation CartBuyerIdentityUpdate($cartId: ID!, $country: CountryCode)
	@inContext(country: $country) {
		cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: { countryCode: $country }) {
			cart {
				...CartFields
			}
			userErrors {
				message
			}
		}
	}
	${CART_FRAGMENT}
`;

const CART_ID_KEY = 'shopify_cart_id';

/**
 * The cart lives at Shopify; the browser keeps only its id. Each change sends
 * one Storefront API request and shows the cart Shopify sends back.
 */
class Cart {
	lines = $state<CartLine[]>([]);
	subtotal = $state<Money | null>(null);
	checkoutUrl = $state<string | null>(null);
	count = $state(0);
	/** Whether the cart sheet is open. */
	open = $state(false);
	/** True while a request is in flight; the cart's controls wait for it. */
	pending = $state(false);
	error = $state<string | null>(null);

	#id: string | null = null;
	#loaded = false;
	/** The market the cart is priced in: the one for the visitor's currency, else the store's default. */
	#country: string | null = null;

	/** Fetches the saved cart, once, in the browser. */
	async load() {
		if (!browser || this.#loaded) return;
		this.#loaded = true;
		const id = readCartId();
		if (!id) return;

		this.pending = true;
		try {
			this.#country = await marketCountry(currency.current);
			const { data, errors } = await storefront().request(CART_QUERY, {
				variables: { id, country: this.#country }
			});
			if (errors) throw new Error(errors.message);
			// A cart that expired or was checked out comes back as null.
			if (data?.cart) this.#show(data.cart);
			else this.clear();
		} catch (error) {
			console.error('Could not load the Shopify cart:', error);
		} finally {
			this.pending = false;
		}
	}

	/**
	 * Prices the cart in the market for `code`, the currency the visitor now
	 * reads prices in, when the store has one. Shopify reprices the lines and
	 * the checkout; nothing is estimated.
	 */
	async market(code: string) {
		const country = await marketCountry(code);
		if (country === this.#country) return;
		this.#country = country;
		if (this.#id) {
			await this.#mutate(CART_BUYER_IDENTITY_UPDATE, 'cartBuyerIdentityUpdate', {
				cartId: this.#id
			});
		}
	}

	async add(merchandiseId: string, quantity = 1, attributes?: { key: string; value: string }[]) {
		await this.load();
		// A new cart starts in the visitor's market; a saved one was loaded in it.
		if (!this.#id) this.#country = await marketCountry(currency.current);
		const lines = [{ merchandiseId, quantity, attributes }];
		if (this.#id) {
			await this.#mutate(CART_LINES_ADD, 'cartLinesAdd', { cartId: this.#id, lines });
		} else {
			await this.#mutate(CART_CREATE, 'cartCreate', { lines });
		}
	}

	/** A quantity of 0 removes the line. */
	async setQuantity(lineId: string, quantity: number) {
		if (quantity <= 0) return this.remove(lineId);
		await this.#mutate(CART_LINES_UPDATE, 'cartLinesUpdate', {
			cartId: this.#id,
			lines: [{ id: lineId, quantity }]
		});
	}

	async remove(lineId: string) {
		await this.#mutate(CART_LINES_REMOVE, 'cartLinesRemove', {
			cartId: this.#id,
			lineIds: [lineId]
		});
	}

	clear() {
		this.#id = null;
		this.lines = [];
		this.subtotal = null;
		this.checkoutUrl = null;
		this.count = 0;
		try {
			localStorage.removeItem(CART_ID_KEY);
		} catch {
			// Blocked storage: nothing was saved either.
		}
	}

	async #mutate(operation: string, field: string, variables: Record<string, unknown>) {
		this.pending = true;
		this.error = null;
		try {
			const { data, errors } = await storefront().request(operation, {
				variables: { ...variables, country: this.#country }
			});
			if (errors) throw new Error(errors.message);
			const payload: CartPayload | undefined = data?.[field];
			if (!payload) throw new Error(`No ${field} in the response`);
			if (payload.userErrors.length > 0) this.error = payload.userErrors[0].message;
			if (payload.cart) this.#show(payload.cart);
		} catch (error) {
			console.error('Shopify cart request failed:', error);
			this.error = 'The cart could not be updated. Try again.';
		} finally {
			this.pending = false;
		}
	}

	#show(cart: ShopifyCart) {
		this.#id = cart.id;
		this.lines = cart.lines.nodes;
		this.subtotal = cart.cost.subtotalAmount;
		this.checkoutUrl = cart.checkoutUrl;
		this.count = cart.totalQuantity;
		try {
			localStorage.setItem(CART_ID_KEY, cart.id);
		} catch {
			// The cart still works for this visit.
		}
	}
}

function readCartId(): string | null {
	try {
		return localStorage.getItem(CART_ID_KEY);
	} catch {
		return null;
	}
}

export const cart = new Cart();

/** Shopify's money, as it priced it, formatted for the page's language in the business's country. */
export function formatMoney({ amount, currencyCode }: Money): string {
	return money(Number(amount), currencyCode);
}
