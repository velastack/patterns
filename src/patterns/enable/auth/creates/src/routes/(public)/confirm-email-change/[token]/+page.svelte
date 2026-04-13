<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { superForm } from 'sveltekit-superforms';
	import { zodClient } from 'sveltekit-superforms/adapters';
	import { confirmEmailChangeSchema } from '$lib/schemas/confirmEmailChange';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';

	let { data } = $props();

	const form = superForm(
		untrack(() => data.form),
		{
			validators: zodClient(confirmEmailChangeSchema)
		}
	);

	const { form: formData } = form;
</script>

<div class="flex flex-col flex-1 items-center justify-center gap-6 p-6 md:p-10">
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
				<Card.Header class="text-center">
					<Card.Title class="text-xl">Confirm your email change</Card.Title>
					<Card.Description>Enter your password to confirm your email change</Card.Description>
				</Card.Header>
				<Card.Content>
					<form method="POST">
						<div class="grid gap-6">
							<div class="grid gap-2">
								<Form.Field {form} name="password" class="col-span-1">
									<Form.Control>
										{#snippet children({ props })}
											<Form.Label>Password</Form.Label>
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

								<Button type="submit" class="w-full">Confirm email change</Button>
							</div>
						</div>
					</form>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
