<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import { site } from '#lib/site.js';

	import { untrack } from 'svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { otpSchema } from '#lib/schemas/otp.js';
	import * as Form from '#lib/components/ui/form/index.js';
	import { Input } from '#lib/components/ui/input/index.js';

	let { data } = $props();

	const form = superForm(
		untrack(() => data.form),
		{
			validators: zod4Client(otpSchema)
		}
	);

	const { form: formData, message } = form;
</script>

<div class="h-full flex flex-col items-center justify-center gap-6 p-6 md:p-10">
	<div class="flex w-full max-w-sm flex-col gap-6">
		<a href="/" class="flex items-center gap-2 self-center font-medium">
			<div
				class="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md"
			>
				<img src={favicon} alt="logo" class="size-4" />
			</div>
			{site.name}
		</a>

		<div class="flex flex-col gap-6">
			<Card.Root>
				<Card.Header class="text-center">
					<Card.Title class="text-xl">Check your WhatsApp</Card.Title>
					<Card.Description>Enter the code we sent to your WhatsApp</Card.Description>
				</Card.Header>
				<Card.Content>
					<form method="POST">
						<div class="grid gap-6">
							<div class="grid gap-2">
								<Form.Field {form} name="otp" class="col-span-1">
									<Form.Control>
										{#snippet children({ props })}
											<Form.Label>Code</Form.Label>
											<Input
												{...props}
												type="text"
												inputmode="numeric"
												autocomplete="one-time-code"
												bind:value={$formData.otp}
												required
												autofocus
											/>
										{/snippet}
									</Form.Control>
									<Form.FieldErrors class="contents text-destructive" />
								</Form.Field>

								{#if $message && $message.type === 'error'}
									<div class="text-destructive text-sm font-medium -mt-2">{$message.text}</div>
								{/if}

								<Button type="submit" class="w-full">Verify code</Button>
							</div>
						</div>
					</form>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>
