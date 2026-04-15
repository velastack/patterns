<script lang="ts">
	import { cn } from '$lib/utils';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { getContext } from 'svelte';
	import { AUTH_MENU_CONTEXT_KEY, type AuthMenuContext } from './context.js';
	let { class: className = '', ...restProps } = $props();

	const { isDesktop } =
		getContext<AuthMenuContext>(AUTH_MENU_CONTEXT_KEY) ?? ({ isDesktop: false } as AuthMenuContext);
</script>

{#if isDesktop}
	<DropdownMenu.Trigger class={cn('inline-flex', className)} {...restProps} />
{/if}
