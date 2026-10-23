/**
 * What the shop sells. Edit this list: it is the catalog the `/shop` pages
 * read. Prices are in `site.currency` (src/lib/site.ts), written as you would
 * write them (`4.5`); leave one out to quote in the chat instead.
 */
export interface Product {
	/** Your own id for the item (a slug or SKU); it is the item's URL and its cart line. */
	id: string;
	name: string;
	description?: string;
	price?: number;
	/** A URL, or a path under `static/`. */
	image?: string;
}

export const catalog: Product[] = [
	{
		id: 'concha',
		name: 'Concha',
		description: 'A sweet bun with a vanilla or cocoa shell.',
		price: 12
	},
	{
		id: 'birthday-cake',
		name: 'Birthday cake',
		description: 'Say the size and the day you need it in the chat.'
	}
];

export const product = (id: string): Product | undefined => catalog.find((item) => item.id === id);
