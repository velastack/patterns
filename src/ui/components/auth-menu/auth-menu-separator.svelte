<script lang="ts">
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { getContext } from 'svelte';
	import { AUTH_MENU_CONTEXT_KEY, type AuthMenuContext } from './context.js';
	const { isDesktop } =
		getContext<AuthMenuContext>(AUTH_MENU_CONTEXT_KEY) ?? ({ isDesktop: false } as AuthMenuContext);
	let restProps = $props();
</script>

{#if isDesktop}
	<DropdownMenu.Separator {...restProps} />
{/if}
