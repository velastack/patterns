<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	import { toggleMode } from 'mode-watcher';
	import * as Navbar from '$lib/components/ui/navbar';
	import { Button } from '$lib/components/ui/button';

	let { children, data } = $props();
</script>

<div class="min-h-dvh">
	<Navbar.Root>
		<Navbar.Brand href="/">
			<Navbar.Logo src={favicon} alt="Logo" />
		</Navbar.Brand>

		<div class="extra-wrapper">
			<Navbar.List>

				<Navbar.Item>
					<Button href="/" variant="ghost">Home</Button>
				</Navbar.Item>

				<Navbar.Item>
					<Button href="/about" variant="ghost">About</Button>
				</Navbar.Item>

			</Navbar.List>
		</div>
	</Navbar.Root>

	{@render children?.()}
</div>
