<script lang="ts">
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { onMount, setContext } from 'svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { AUTH_MENU_CONTEXT_KEY, type AuthMenuContext } from './context.js';

	let { user, guest } = $props();

	const breakpoint = 768;
	const breakpointQuery = `(min-width: ${breakpoint}px)`;

	let hasMounted = $state(false);
	let authMenuContext = $state<AuthMenuContext>({ isDesktop: true });

	setContext(AUTH_MENU_CONTEXT_KEY, authMenuContext);

	function updateIsDesktop() {
		if (!browser) return;
		authMenuContext.isDesktop = window.matchMedia(breakpointQuery).matches;
	}

	onMount(() => {
		updateIsDesktop();
		hasMounted = true;
		const mq = window.matchMedia(breakpointQuery);
		const listener = () => (authMenuContext.isDesktop = mq.matches);
		mq.addEventListener('change', listener);
		return () => mq.removeEventListener('change', listener);
	});
</script>

{#if page.data.user}
	{#if authMenuContext.isDesktop}
		<DropdownMenu.Root>
			{@render user?.()}
		</DropdownMenu.Root>
	{:else}
		<!-- This prevents the menu from being rendered twice before we know if we're on desktop or not -->
		{#if hasMounted}
			{@render user?.()}
		{/if}
	{/if}
{:else}
	{@render guest?.()}
{/if}
