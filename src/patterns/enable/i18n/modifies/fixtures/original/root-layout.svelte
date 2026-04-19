<script lang="ts">
	import { toggleMode } from 'mode-watcher';
	import * as Navbar from '$lib/components/ui/navbar';
	import { Button } from '$lib/components/ui/button';

	let { children, data } = $props();
</script>

<div class="min-h-dvh grid grid-rows-[max-content_1fr_max-content] root-layout">
	<Navbar.Root>
		<Navbar.Brand href="/">
			<Navbar.Logo src="/favicon.svg" alt="Logo" />
		</Navbar.Brand>

		<Navbar.MobileToggle />

		<Navbar.List>
			<Navbar.Item>
				<Button class="w-full justify-start md:justify-center md:w-auto" href="/" variant="ghost">
					Home
				</Button>
			</Navbar.Item>
		</Navbar.List>
	</Navbar.Root>

	{@render children?.()}
</div>
