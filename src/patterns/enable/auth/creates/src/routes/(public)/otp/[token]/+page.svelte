<script lang="ts">
	import { untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { otpSchema } from '$lib/schemas/otp';
	import * as Form from '$lib/components/ui/form';
	import { Input } from '$lib/components/ui/input';

	let { data } = $props();

	const form = superForm(
		untrack(() => data.form),
		{
			validators: zod4Client(otpSchema)
		}
	);

	const { form: formData, message } = form;
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
					<Card.Title class="text-xl">Enter your OTP code</Card.Title>
					<Card.Description>Enter the code sent to your email</Card.Description>
				</Card.Header>
				<Card.Content>
					<form method="POST">
						<div class="grid gap-6">
							<div class="grid gap-2">
								<Form.Field {form} name="otp" class="col-span-1">
									<Form.Control>
										{#snippet children({ props })}
											<Form.Label>OTP code</Form.Label>
											<Input {...props} type="text" bind:value={$formData.otp} required />
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
