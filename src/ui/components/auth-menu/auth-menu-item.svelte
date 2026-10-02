<script lang="ts">
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { getContext } from 'svelte';
	import { AUTH_MENU_CONTEXT_KEY, type AuthMenuContext } from './context.js';
	let { children, href = undefined, ...restProps } = $props();

	const { isDesktop } =
		getContext<AuthMenuContext>(AUTH_MENU_CONTEXT_KEY) ?? ({ isDesktop: false } as AuthMenuContext);
</script>

{#if isDesktop}
	{#if href && !restProps.onclick}
		<!-- A link rather than goto(), which rejects any URL that is not a page of
		     the app: SvelteKit still routes app pages, and the browser loads the rest. -->
		<DropdownMenu.Item {...restProps}>
			{#snippet child({ props })}
				<a {href} {...props}>
					{@render children?.()}
				</a>
			{/snippet}
		</DropdownMenu.Item>
	{:else}
		<DropdownMenu.Item {...restProps}>
			{@render children?.()}
		</DropdownMenu.Item>
	{/if}
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
