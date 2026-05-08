import { definePageMetaTags } from 'svelte-meta-tags';

export const load = async ({ parent, data }) => {
	await parent();

	const { pageMetaTags } = definePageMetaTags({
		title: 'Confirm password reset'
	});

	return { ...data, pageMetaTags };
};
