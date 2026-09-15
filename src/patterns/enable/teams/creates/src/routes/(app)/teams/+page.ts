import { definePageMetaTags } from 'svelte-meta-tags';

export const load = async ({ parent }) => {
	await parent();

	const { pageMetaTags } = definePageMetaTags({
		title: 'Teams'
	});

	return { pageMetaTags };
};
