<script lang="ts">
	import { goto } from '$app/navigation';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { Button } from '$lib/components/ui/button';
	import { getContext } from 'svelte';
	import { AUTH_MENU_CONTEXT_KEY, type AuthMenuContext } from './context.js';
	let { children, href = undefined, ...restProps } = $props();

	const { isDesktop } =
		getContext<AuthMenuContext>(AUTH_MENU_CONTEXT_KEY) ?? ({ isDesktop: false } as AuthMenuContext);

	const handleClick = () => {
		if (restProps.onclick) {
			restProps.onclick();
		} else {
			if (href) {
				goto(href);
			}
		}
	};
</script>

{#if isDesktop}
	<DropdownMenu.Item {...restProps} onclick={handleClick}>
		{@render children?.()}
	</DropdownMenu.Item>
{:else}
	<Button
		class="w-full justify-start md:justify-center md:w-auto"
		variant="ghost"
		{href}
		{...restProps}
	>
		{@render children?.()}
	</Button>
{/if}
