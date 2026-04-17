<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import SetupButton from '$lib/components/payments/setup-button.svelte';
	import { CreditCard, Trash2, Check } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { invalidate } from '$app/navigation';

	let { data } = $props();
	let paymentMethods = $derived(data.paymentMethods);
	let showDeleteDialog = $state(false);
	let selectedPaymentMethodId = $state<string | null>(null);
	let isProcessing = $state(false);

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
</div>

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
