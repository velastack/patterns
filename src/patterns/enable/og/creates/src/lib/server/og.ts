import type { ComponentProps } from 'svelte';
import { render } from 'svelte/server';
import { Renderer } from '@takumi-rs/core';
import Card from '#lib/og/card.svelte';

/**
 * One renderer for the life of the server. It draws text in its built-in font
 * (Geist). To use another, register the font file once, here, and name its
 * family in the card's CSS:
 *
 *   import font from './my-font.woff2?inline';
 *   await renderer.registerFont(Buffer.from(font.split(',')[1], 'base64'));
 */
const renderer = new Renderer();

/** Renders the share card to a 1200x630 PNG. */
export async function renderCard(props: ComponentProps<typeof Card>) {
	const { head, body } = render(Card, { props });
	const css = [...head.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((match) => match[1]);
	return renderer.render(body, { width: 1200, height: 630, format: 'png', css });
}
