<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { loginSchema } from '$lib/schemas/login';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';
	import PocketBase from 'pocketbase-svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let { data } = $props();
	let authMethods = $derived(data.authMethods);

	const redirect = page.url.searchParams.get('redirect');
	const hasOAuth2 = $derived(authMethods.oauth2.enabled && authMethods.oauth2.providers.length > 0);
	const hasAuthMethods = $derived(
		authMethods.password.enabled || authMethods.otp.enabled || hasOAuth2
	);

	const form = superForm(
		untrack(() => data.form),
		{
			validators: zodClient(loginSchema)
		}
	);

	const handleOAuth2 = (provider: string) => {
		const pb = new PocketBase('/');

		pb.collection('users')
			.authWithOAuth2({ provider, createData: {} })
			.then(() => goto('/dashboard'));
	};

	const { form: formData, message } = form;
</script>

<div class="h-full flex flex-col items-center justify-center gap-6 p-6 md:p-10">
	<div class="flex w-full max-w-sm flex-col gap-6">
		<a href="/" class="flex items-center gap-2 self-center font-medium">
			<div
				class="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md"
			>
				<img src="/favicon.svg" alt="logo" class="size-4" />
			</div>
			{data.meta.appName}
		</a>

		<div class="flex flex-col gap-6">
			<Card.Root>
				{#if hasAuthMethods}
					<Card.Header class="text-center">
						<Card.Title class="text-xl">Welcome back</Card.Title>
						{#if hasOAuth2}
							<Card.Description>Choose a login method</Card.Description>
						{:else}
							<Card.Description>Use your email to login</Card.Description>
						{/if}
					</Card.Header>
				{:else}
					<Card.Header class="text-center">
						<Card.Title class="text-xl">Login is disabled</Card.Title>
						<Card.Description>Check back later for login options</Card.Description>
					</Card.Header>
				{/if}
				<Card.Content>
					<form method="POST">
						<div class="grid gap-6">
							{#if hasOAuth2}
								<div class="flex flex-col gap-4">
									{#each authMethods.oauth2.providers as provider}
										<Button
											variant="outline"
											class="w-full"
											onclick={() => handleOAuth2(provider.name)}
										>
											<img
												src="/admin/_/images/oauth2/{provider.name}.svg"
												class="size-5 bg-white p-0.5 rounded-sm"
												alt=""
											/>
											Login with {provider.displayName}
										</Button>
									{/each}
								</div>
							{/if}

							{#if authMethods.password.enabled || authMethods.otp.enabled}
								{#if hasOAuth2}
									<div
										class="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t"
									>
										<span class="bg-card text-muted-foreground relative z-10 px-2">
											Or continue with
										</span>
									</div>
								{/if}

								<div class="grid gap-2">
									<Form.Field {form} name="email" class="col-span-1">
										<Form.Control>
											{#snippet children({ props })}
												<Form.Label>Email</Form.Label>
												<Input {...props} type="email" bind:value={$formData.email} required />
											{/snippet}
										</Form.Control>
										<Form.FieldErrors class="contents text-destructive" />
									</Form.Field>

									{#if $formData.type === 'password' && authMethods.password.enabled}
										<Form.Field {form} name="password" class="col-span-1">
											<Form.Control>
												{#snippet children({ props })}
													<div class="flex justify-between">
														<Form.Label>Password</Form.Label>
														<a
															href="/reset"
															class="ml-auto text-sm underline-offset-4 hover:underline"
															>Forgot your password?</a
														>
													</div>
													<Input
														{...props}
														type="password"
														bind:value={$formData.password}
														required
														autocomplete="current-password"
													/>
												{/snippet}
											</Form.Control>
											<Form.FieldErrors class="contents text-destructive" />
										</Form.Field>

										{#if $message && $message.type === 'error'}
											<div class="text-destructive text-sm font-medium -mt-2">{$message.text}</div>
										{/if}

										<Button type="submit" class="w-full">Login</Button>
										{#if authMethods.otp.enabled}
											<Button
												variant="outline"
												class="w-full"
												onclick={() => ($formData.type = 'otp' as 'password')}
												>Use one-time code instead</Button
											>
										{/if}
									{:else if $formData.type === 'otp' && authMethods.otp.enabled}
										<Button type="submit" class="w-full">Send one-time code</Button>
										{#if authMethods.password.enabled}
											<Button
												variant="outline"
												class="w-full"
												onclick={() => ($formData.type = 'password' as 'otp')}
												>Continue with password</Button
											>
										{/if}
									{/if}
								</div>

								<input type="hidden" name="type" bind:value={$formData.type} />
							{/if}

							<div class="text-center text-sm">
								Don&apos;t have an account?
								<a
									href="/signup{redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}"
									class="underline underline-offset-4">Sign up</a
								>
							</div>
						</div>
					</form>
				</Card.Content>
			</Card.Root>
			<div
				class="text-muted-foreground *:[a]:hover:text-primary *:[a]:underline *:[a]:underline-offset-4 text-balance text-center text-xs"
			>
				By clicking continue, you agree to our <a href="/terms">Terms of Service</a>
				and <a href="/privacy">Privacy Policy</a>.
			</div>
		</div>
	</div>
</div>
