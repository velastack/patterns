import { error } from '@sveltejs/kit';
import { catalog, product } from '#lib/catalog.js';

// The catalog is a module, so every item's page can be prerendered.
export const entries = () => catalog.map(({ id }) => ({ id }));

export const load = ({ params }) => {
	const item = product(params.id);
	if (!item) error(404, 'Not found');
	return { item };
};
