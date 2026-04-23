<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import SetupButton from '$lib/components/payments/setup-button.svelte';
	import { CreditCard, Trash2, Check, Package } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { invalidate, invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';

	let { data } = $props();
	let paymentMethods = $derived(data.paymentMethods);
	let availablePlans = $derived(data.availablePlans);
	let hasDefaultPaymentMethod = $derived(data.hasDefaultPaymentMethod);

	// Local, mutable mirror of the server-side subscription. We optimistically
	// update it on user actions so the UI reflects the change immediately; the
	// $effect re-syncs from the server after the webhook has had a chance to
	// fire (invalidateAll runs on a short delay below).
	let activeSubscription = $state(untrack(() => data.activeSubscription));
	$effect(() => {
		activeSubscription = data.activeSubscription;
	});
	let showDeleteDialog = $state(false);
	let selectedPaymentMethodId = $state<string | null>(null);
	let isProcessing = $state(false);
	let showCancelDialog = $state(false);
	let isSubscribing = $state<string | null>(null);
	let isCanceling = $state(false);

	function openDeleteDialog(paymentMethodId: string) {
		selectedPaymentMethodId = paymentMethodId;
		showDeleteDialog = true;
	}

	function closeDeleteDialog() {
		showDeleteDialog = false;
		selectedPaymentMethodId = null;
	}

	async function handleDeletePaymentMethod() {
		if (!selectedPaymentMethodId) return;
		isProcessing = true;

		try {
			const formData = new FormData();
			formData.append('paymentMethodId', selectedPaymentMethodId);

			await fetch('?/deletePaymentMethod', {
				method: 'POST',
				body: formData
			});

			await invalidate('app:billing');
			toast.success('Payment method removed successfully');
			closeDeleteDialog();
		} catch (err) {
			console.error('Error deleting payment method:', err);
			toast.error('Failed to remove payment method');
		} finally {
			isProcessing = false;
		}
	}

	async function setDefaultPaymentMethod(paymentMethodId: string) {
		try {
			const formData = new FormData();
			formData.append('paymentMethodId', paymentMethodId);

			await fetch('?/setDefaultPaymentMethod', {
				method: 'POST',
				body: formData
			});

			await invalidate('app:billing');
			toast.success('Default payment method updated');
		} catch (err) {
			console.error('Error setting default payment method:', err);
			toast.error('Failed to update default payment method');
		}
	}

	function getCardBrandIcon(brand: string) {
		// You can customize these icons or use actual card brand icons
		const brands: Record<string, string> = {
			visa: '💳',
			mastercard: '💳',
			amex: '💳',
			discover: '💳',
			unknown: '💳'
		};
		return brands[brand.toLowerCase()] || brands.unknown;
	}

	function formatCardBrand(brand: string) {
		return brand.charAt(0).toUpperCase() + brand.slice(1);
	}

	function formatAmount(amount: number | null, currency: string | null) {
		if (amount === null || !currency) return '—';
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency.toUpperCase()
		}).format(amount / 100);
	}

	function formatInterval(recurring: { interval: string; interval_count: number } | null) {
		if (!recurring) return '';
		if (recurring.interval_count === 1) return `/ ${recurring.interval}`;
		return `every ${recurring.interval_count} ${recurring.interval}s`;
	}

	function formatDate(iso: string | null) {
		if (!iso) return '—';
		return new Date(iso).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	async function selectPlan(priceId: string, successMessage: string) {
		if (!hasDefaultPaymentMethod) {
			toast.error('Add a default payment method first');
			return;
		}
		const previous = activeSubscription;
		const plan = availablePlans.find((p) => p.id === priceId);
		if (plan) {
			activeSubscription = previous
				? {
						...previous,
						priceId,
						productName: plan.productName,
						unitAmount: plan.unitAmount,
						currency: plan.currency,
						recurring: plan.recurring,
						cancelAtPeriodEnd: false
					}
				: {
						id: 'pending',
						status: 'active',
						priceId,
						productName: plan.productName,
						unitAmount: plan.unitAmount,
						currency: plan.currency,
						recurring: plan.recurring,
						cancelAtPeriodEnd: false,
						currentPeriodStart: null,
						currentPeriodEnd: null,
						canceledAt: null
					};
		}

		isSubscribing = priceId;
		try {
			const formData = new FormData();
			formData.append('priceId', priceId);

			const res = await fetch('?/selectPlan', {
				method: 'POST',
				body: formData
			});

			if (!res.ok) {
				throw new Error(`selectPlan failed: ${res.status}`);
			}

			toast.success(successMessage);
			setTimeout(() => {
				invalidateAll();
			}, 2000);
		} catch (err) {
			console.error('Error selecting plan:', err);
			toast.error('Failed to update plan');
			activeSubscription = previous;
		} finally {
			isSubscribing = null;
		}
	}

	async function subscribe(priceId: string) {
		await selectPlan(priceId, 'Subscription started');
	}

	async function switchPlan(priceId: string) {
		await selectPlan(priceId, 'Subscription updated');
	}

	async function resumeSubscription() {
		if (!activeSubscription) return;
		const previous = activeSubscription;
		isSubscribing = activeSubscription.priceId;
		activeSubscription = { ...activeSubscription, cancelAtPeriodEnd: false };
		try {
			const formData = new FormData();
			formData.append('subscriptionId', previous.id);

			const res = await fetch('?/resumeSubscription', {
				method: 'POST',
				body: formData
			});

			if (!res.ok) {
				throw new Error(`Resume failed: ${res.status}`);
			}

			toast.success('Subscription resumed');
			setTimeout(() => {
				invalidateAll();
			}, 2000);
		} catch (err) {
			console.error('Error resuming subscription:', err);
			toast.error('Failed to resume subscription');
			activeSubscription = previous;
		} finally {
			isSubscribing = null;
		}
	}

	async function handleCancelSubscription() {
		if (!activeSubscription) return;
		const previous = activeSubscription;
		isCanceling = true;
		activeSubscription = { ...activeSubscription, cancelAtPeriodEnd: true };
		try {
			const formData = new FormData();
			formData.append('subscriptionId', previous.id);

			const res = await fetch('?/cancelSubscription', {
				method: 'POST',
				body: formData
			});

			if (!res.ok) {
				throw new Error(`Cancel failed: ${res.status}`);
			}

			toast.success('Subscription will cancel at period end');
			showCancelDialog = false;
			setTimeout(() => {
				invalidateAll();
			}, 2000);
		} catch (err) {
			console.error('Error canceling subscription:', err);
			toast.error('Failed to cancel subscription');
			activeSubscription = previous;
		} finally {
			isCanceling = false;
		}
	}
</script>

<div class="divide-y divide-gray-900/10 dark:divide-white/10">
	<div class="grid grid-cols-1 gap-x-8 gap-y-8 py-10 md:grid-cols-3">
		<div class="px-4 sm:px-0">
			<h2 class="text-base/7 font-semibold text-gray-900 dark:text-white">Payment Methods</h2>
			<p class="mt-1 text-sm/6 text-gray-600 dark:text-gray-400">
				Manage your payment methods for subscriptions and purchases.
			</p>
		</div>

		<div class="md:col-span-2">
			<Card.Root>
				<Card.Content>
					{#if paymentMethods.length === 0}
						<div
							class="text-muted-foreground flex flex-col items-center justify-center py-12 text-center"
						>
							<CreditCard class="mb-4 size-12 opacity-50" />
							<p class="mb-2 text-lg font-medium">No payment methods</p>
							<p class="text-sm">Add a payment method to get started</p>
						</div>
					{:else}
						<div class="space-y-4">
							{#each paymentMethods as method (method.id)}
								<div
									class="border-border hover:bg-accent/50 flex items-center justify-between rounded-lg border p-4 transition-colors"
								>
									<div class="flex items-center gap-4">
										<div
											class="bg-muted flex size-12 items-center justify-center rounded-lg text-2xl"
										>
											{getCardBrandIcon(method.brand)}
										</div>
										<div>
											<div class="flex items-center gap-2">
												<p class="font-medium">
													{formatCardBrand(method.brand)} •••• {method.last4}
												</p>
												{#if method.isDefault}
													<Badge variant="secondary">
														<Check class="mr-1 size-3" />
														Default
													</Badge>
												{/if}
											</div>
											<p class="text-muted-foreground text-sm">
												Expires {method.expMonth.toString().padStart(2, '0')}/{method.expYear}
											</p>
										</div>
									</div>
									<div class="flex items-center gap-2">
										{#if !method.isDefault}
											<Button
												variant="outline"
												size="sm"
												onclick={() => setDefaultPaymentMethod(method.id)}
											>
												Set as Default
											</Button>
										{/if}
										<Button
											variant="outline"
											size="icon-sm"
											onclick={() => openDeleteDialog(method.id)}
											disabled={method.isDefault && paymentMethods.length === 1}
										>
											<Trash2 class="size-4" />
										</Button>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</Card.Content>
				<Card.Footer class="border-t justify-end">
					<SetupButton
						label="Add Payment Method"
						processingLabel="Adding..."
						onsuccess={() => invalidate('app:billing')}
					/>
				</Card.Footer>
			</Card.Root>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-x-8 gap-y-8 py-10 md:grid-cols-3">
		<div class="px-4 sm:px-0">
			<h2 class="text-base/7 font-semibold text-gray-900 dark:text-white">Plan</h2>
			<p class="mt-1 text-sm/6 text-gray-600 dark:text-gray-400">Manage your subscription.</p>
		</div>

		<div class="md:col-span-2">
			<Card.Root>
				<Card.Content>
					{#if availablePlans.length === 0}
						<div
							class="text-muted-foreground flex flex-col items-center justify-center py-12 text-center"
						>
							<Package class="mb-4 size-12 opacity-50" />
							<p class="mb-2 text-lg font-medium">No plans available</p>
							<p class="text-sm">Check back soon.</p>
						</div>
					{:else}
						{#if !hasDefaultPaymentMethod}
							<p class="text-muted-foreground mb-4 rounded-md border border-dashed p-3 text-sm">
								Add a default payment method above to subscribe.
							</p>
						{/if}
						<div class="space-y-4">
							{#each availablePlans as plan (plan.id)}
								{@const isCurrent = activeSubscription?.priceId === plan.id}
								<div
									class="flex items-center justify-between rounded-lg border p-4 transition-colors {isCurrent
										? 'border-primary ring-primary ring-1'
										: 'border-border hover:bg-accent/50'}"
								>
									<div class="flex items-center gap-4">
										<div class="bg-muted flex size-12 items-center justify-center rounded-lg">
											<Package class="size-5" />
										</div>
										<div>
											<div class="flex items-center gap-2">
												<p class="font-medium">{plan.productName}</p>
												{#if isCurrent && activeSubscription}
													{#if activeSubscription.cancelAtPeriodEnd}
														<Badge variant="outline">Pending cancellation</Badge>
													{:else if activeSubscription.status === 'trialing'}
														<Badge variant="secondary">Trial</Badge>
													{:else if activeSubscription.status === 'past_due'}
														<Badge variant="destructive">Past due</Badge>
													{:else}
														<Badge variant="secondary">
															<Check class="mr-1 size-3" />
															Current
														</Badge>
													{/if}
												{/if}
											</div>
											<p class="text-muted-foreground text-sm">
												{formatAmount(plan.unitAmount, plan.currency)}
												{formatInterval(plan.recurring)}
												{#if isCurrent && activeSubscription?.currentPeriodEnd}
													<span>
														&bull;
														{activeSubscription.cancelAtPeriodEnd ? 'Cancels on' : 'Renews on'}
														{formatDate(activeSubscription.currentPeriodEnd)}
													</span>
												{/if}
											</p>
										</div>
									</div>
									<div class="flex items-center gap-2">
										{#if isCurrent && activeSubscription}
											{#if activeSubscription.cancelAtPeriodEnd}
												<Button
													variant="outline"
													size="sm"
													disabled={isSubscribing === plan.id}
													onclick={resumeSubscription}
												>
													{isSubscribing === plan.id ? 'Resuming...' : 'Resume'}
												</Button>
											{:else}
												<Button
													variant="outline"
													size="sm"
													onclick={() => (showCancelDialog = true)}
												>
													Cancel subscription
												</Button>
											{/if}
										{:else if activeSubscription}
											<Button
												variant="outline"
												size="sm"
												disabled={!hasDefaultPaymentMethod || isSubscribing === plan.id}
												onclick={() => switchPlan(plan.id)}
											>
												{isSubscribing === plan.id ? 'Switching...' : 'Switch'}
											</Button>
										{:else}
											<Button
												variant="outline"
												size="sm"
												disabled={!hasDefaultPaymentMethod || isSubscribing === plan.id}
												onclick={() => subscribe(plan.id)}
											>
												{isSubscribing === plan.id ? 'Subscribing...' : 'Subscribe'}
											</Button>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>

<!-- Cancel Subscription Dialog -->
<AlertDialog.Root bind:open={showCancelDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Cancel Subscription</AlertDialog.Title>
			<AlertDialog.Description>
				Your subscription will remain active until the end of the current billing period, then
				cancel automatically.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={() => (showCancelDialog = false)}>
				Keep Subscription
			</AlertDialog.Cancel>
			<AlertDialog.Action onclick={handleCancelSubscription} disabled={isCanceling}>
				{isCanceling ? 'Canceling...' : 'Cancel at Period End'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={showDeleteDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Remove Payment Method</AlertDialog.Title>
			<AlertDialog.Description>
				Are you sure you want to remove this payment method? This action cannot be undone.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={closeDeleteDialog}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action onclick={handleDeletePaymentMethod} disabled={isProcessing}>
				{isProcessing ? 'Removing...' : 'Remove'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
