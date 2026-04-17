<script lang="ts">
	import { untrack } from 'svelte';
	import { superForm } from 'sveltekit-superforms';
	import { zod4Client } from 'sveltekit-superforms/adapters';
	import { changeEmailSchema } from '$lib/schemas/changeEmail';
	import { changePasswordSchema } from '$lib/schemas/changePassword';
	import { profileSchema } from '$lib/schemas/profile';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import * as Form from '$lib/components/ui/form';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as FileForm from '$lib/components/ui/file-form';

	let { data } = $props();

	const profileForm = superForm(
		untrack(() => data.profileForm),
		{
			validators: zod4Client(profileSchema),
			id: 'profileForm'
		}
	);

	const emailForm = superForm(
		untrack(() => data.emailForm),
		{
			validators: zod4Client(changeEmailSchema),
			id: 'emailForm'
		}
	);

	const passwordForm = superForm(
		untrack(() => data.passwordForm),
		{
			validators: zod4Client(changePasswordSchema),
			id: 'passwordForm'
		}
	);

	const { form: profileFormData } = profileForm;
	const { form: emailFormData } = emailForm;
	const { form: passwordFormData } = passwordForm;
</script>

<div class="divide-y divide-gray-900/10 dark:divide-white/10">
	<div class="grid grid-cols-1 gap-x-8 gap-y-8 py-10 md:grid-cols-3">
		<div class="px-4 sm:px-0">
			<h2 class="text-base/7 font-semibold text-gray-900 dark:text-white">Profile</h2>
			<p class="mt-1 text-sm/6 text-gray-600 dark:text-gray-400">Your profile information.</p>
		</div>

		<form
			method="POST"
			action="?/updateProfile"
			enctype="multipart/form-data"
			class="md:col-span-2"
		>
			<Card.Root>
				<Card.Content class="flex flex-col gap-6">
					<FileForm.Field form={profileForm} name="avatar" class="col-span-1">
						<Form.Control>
							{#snippet children({ props })}
								<div class="flex items-center gap-3 justify-between">
									{#if !$profileFormData.avatar}
										<div class="flex items-center gap-3">
											<Avatar.Root class="size-16">
												<Avatar.Fallback>
													{data.user.email.charAt(0).toUpperCase()}
												</Avatar.Fallback>
											</Avatar.Root>
											<div>
												<span class="text-sm font-medium leading-none">Avatar</span>
												<p class="text-muted-foreground text-sm">
													Upload a new avatar for your profile.
												</p>
											</div>
										</div>
									{/if}
									<FileForm.Single>
										{#snippet display({ file, filename, onremove })}
											<div class="flex-1 flex gap-2 justify-between items-center">
												<div class="flex items-center gap-3">
													<FileForm.Thumb
														{file}
														{filename}
														collectionId="users"
														id={data.user.id}
														class="w-16 h-16 object-cover rounded-full"
													/>
													<div>
														<span class="text-sm font-medium leading-none">Avatar</span>
														<p class="text-muted-foreground text-sm">
															Upload a new avatar for your profile.
														</p>
													</div>
												</div>
												<Button variant="outline" onclick={() => onremove(file)}>
													Remove avatar
												</Button>
											</div>
										{/snippet}
										{#snippet input()}
											<Form.Label class={buttonVariants({ variant: 'outline' })}>
												Upload new picture
											</Form.Label>
											<FileForm.Input class="hidden" {...props} />
										{/snippet}
									</FileForm.Single>
								</div>
							{/snippet}
						</Form.Control>
						<Form.FieldErrors class="contents text-destructive" />
					</FileForm.Field>

					<div class="grid gap-6">
						<div class="grid gap-3">
							<Form.Field form={profileForm} name="name">
								<Form.Control>
									{#snippet children({ props })}
										<Form.Label>Name</Form.Label>
										<Input {...props} type="text" bind:value={$profileFormData.name} />
									{/snippet}
								</Form.Control>
								<Form.FieldErrors class="contents text-destructive" />
							</Form.Field>
						</div>
					</div>
					<div class="grid gap-6">
						<div class="grid gap-3">
							<Form.Field form={profileForm} name="emailVisibility" class="flex items-start gap-2">
								<Form.Control>
									{#snippet children({ props })}
										<Checkbox {...props} bind:checked={$profileFormData.emailVisibility} />
										<div class="grid gap-2">
											<Form.Label>Display email publicly</Form.Label>
											<p class="text-muted-foreground text-sm">
												By clicking this checkbox, your email will be displayed publicly.
											</p>
										</div>
									{/snippet}
								</Form.Control>
								<Form.FieldErrors class="contents text-destructive" />
							</Form.Field>
						</div>
					</div>
				</Card.Content>
				<Card.Footer class="border-t justify-end">
					<Button type="submit" class="w-fit">Save changes</Button>
				</Card.Footer>
			</Card.Root>
		</form>
	</div>

	<div class="grid grid-cols-1 gap-x-8 gap-y-8 py-10 md:grid-cols-3">
		<div class="px-4 sm:px-0">
			<h2 class="text-base/7 font-semibold text-gray-900 dark:text-white">Email</h2>
			<p class="mt-1 text-sm/6 text-gray-600 dark:text-gray-400">
				The email address associated with your account.
			</p>
		</div>

		<Card.Root class="md:col-span-2">
			<Card.Content class="flex flex-col gap-6">
				<div class="flex justify-between items-center">
					<span class="text-sm flex items-center gap-2">
						{data.user.email}
						<Badge variant="secondary">{data.user.verified ? 'Verified' : 'Unverified'}</Badge>
					</span>
					<div class="flex items-center gap-3">
						{#if !data.user.verified}
							<form method="POST" action="?/resendVerificationEmail">
								<Button type="submit" variant="outline" class="w-fit"
									>Resend verification email</Button
								>
							</form>
						{/if}

						<Dialog.Root>
							<Dialog.Trigger class={buttonVariants({ variant: 'outline' })}>
								Change email
							</Dialog.Trigger>
							<Dialog.Content>
								<Dialog.Header>
									<Dialog.Title>Change email</Dialog.Title>
									<Dialog.Description>
										Enter your new email address. You will receive a verification email.
									</Dialog.Description>
								</Dialog.Header>
								<form method="POST" action="?/changeEmail">
									<div class="grid gap-6">
										<div class="grid gap-3">
											<Form.Field form={emailForm} name="email">
												<Form.Control>
													{#snippet children({ props })}
														<Form.Label>Email</Form.Label>
														<Input
															{...props}
															type="email"
															bind:value={$emailFormData.email}
															required
														/>
													{/snippet}
												</Form.Control>
												<Form.FieldErrors class="contents text-destructive" />
											</Form.Field>
										</div>
									</div>
								</form>
								<Dialog.Footer>
									<Button type="submit" class="w-fit">Change email</Button>
								</Dialog.Footer>
							</Dialog.Content>
						</Dialog.Root>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<div class="grid grid-cols-1 gap-x-8 gap-y-8 py-10 md:grid-cols-3">
		<div class="px-4 sm:px-0">
			<h2 class="text-base/7 font-semibold text-gray-900 dark:text-white">Password</h2>
			<p class="mt-1 text-sm/6 text-gray-600 dark:text-gray-400">
				Your password is used to log in to your account.
			</p>
		</div>

		<form method="POST" action="?/changePassword" class="md:col-span-2">
			<Card.Root>
				<Card.Content class="flex flex-col gap-6">
					<div class="grid gap-6">
						<div class="grid gap-3">
							<Form.Field form={passwordForm} name="password">
								<Form.Control>
									{#snippet children({ props })}
										<Form.Label>New password</Form.Label>
										<Input
											{...props}
											type="password"
											bind:value={$passwordFormData.password}
											autocomplete="new-password"
											required
										/>
									{/snippet}
								</Form.Control>
								<Form.FieldErrors class="contents text-destructive" />
							</Form.Field>
						</div>
						<div class="grid gap-3">
							<Form.Field form={passwordForm} name="passwordConfirm">
								<Form.Control>
									{#snippet children({ props })}
										<Form.Label>Confirm new password</Form.Label>
										<Input
											{...props}
											type="password"
											bind:value={$passwordFormData.passwordConfirm}
											autocomplete="new-password"
											required
										/>
									{/snippet}
								</Form.Control>
								<Form.FieldErrors class="contents text-destructive" />
							</Form.Field>
						</div>
					</div>
				</Card.Content>
				<Card.Footer class="border-t justify-end">
					<Button type="submit" class="w-fit">Update password</Button>
				</Card.Footer>
			</Card.Root>
		</form>
	</div>
</div>
