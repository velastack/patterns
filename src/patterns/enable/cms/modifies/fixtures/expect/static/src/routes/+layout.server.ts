import { error, redirect } from '@sveltejs/kit';
import { loadCms } from '$lib/cms';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const { cms, notFound, gone, redirectTo } = await loadCms(event, { locale: 'en' });
	if (redirectTo) redirect(308, redirectTo);
	if (gone) error(410, 'Gone');
	if (notFound) error(404, 'Not found');

	return { cms };
};
