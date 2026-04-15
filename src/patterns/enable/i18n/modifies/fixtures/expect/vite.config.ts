import { wuchale } from 'wuchale/vite';
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [wuchale(), tailwindcss(), sveltekit()]
});
