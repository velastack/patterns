<script lang="ts">
	import { toggleMode } from 'mode-watcher';
	import * as Navbar from '$lib/components/ui/navbar';
	import { Button } from '$lib/components/ui/button';
	import * as AuthMenu from '$lib/components/ui/auth-menu';
	import * as Avatar from '$lib/components/ui/avatar';

	let { children, data } = $props();
</script>

<div class="min-h-dvh">
	<Navbar.Root>
		<Navbar.Brand href="/">
			<Navbar.Logo src="/favicon.svg" alt="Logo" />
		</Navbar.Brand>

		<div class="extra-wrapper">
			<Navbar.List>

				<Navbar.Item>
					<Button href="/" variant="ghost">Home</Button>
				</Navbar.Item>

				<Navbar.Item>
					<Button href="/about" variant="ghost">About</Button>
				</Navbar.Item>

				<Navbar.Item
					class="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-4"
				>
					<AuthMenu.Root>
						{#snippet user()}
							<AuthMenu.Trigger>
								<Avatar.Root>
									{#if data.user?.avatar}
										<Avatar.Image
											src="/api/files/users/{data.user?.id}/{data.user?.avatar}"
											alt={data.user?.email}
										/>
									{/if}
									<Avatar.Fallback>
										{data.user?.email?.charAt(0).toUpperCase()}
									</Avatar.Fallback>
								</Avatar.Root>
							</AuthMenu.Trigger>

							<AuthMenu.Content align="end">
								<AuthMenu.Item href="/dashboard">Dashboard</AuthMenu.Item>
								<AuthMenu.Group>
									<AuthMenu.Item href="/settings">Settings</AuthMenu.Item>
									<AuthMenu.Item>
										<form action="/logout" method="post">
											<button type="submit" class="contents">Logout</button>
										</form>
									</AuthMenu.Item>
								</AuthMenu.Group>
							</AuthMenu.Content>
						{/snippet}

						{#snippet guest()}
							<Button
								class="w-full justify-start md:justify-center md:w-auto"
								variant="ghost"
								href="/login">Login</Button
							>
							<Button
								class="w-full justify-start md:justify-center md:w-auto"
								variant="outline"
								href="/signup">Sign up</Button
							>
						{/snippet}
					</AuthMenu.Root>
				</Navbar.Item>
			</Navbar.List>
		</div>
	</Navbar.Root>

	{@render children?.()}
</div>
