<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { getContext } from 'svelte';
	import { AUTH_MENU_CONTEXT_KEY, type AuthMenuContext } from './context.js';
	let { isDesktop } =
		getContext<AuthMenuContext>(AUTH_MENU_CONTEXT_KEY) ?? ({ isDesktop: false } as AuthMenuContext);
	let { children, ...restProps } = $props();
</script>

{#if isDesktop}
	<DropdownMenu.Group {...restProps}>
		{@render children?.()}
	</DropdownMenu.Group>
{:else}
	{@render children?.()}
{/if}
