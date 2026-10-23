<script lang="ts">
	import { onMount } from 'svelte';
	import * as Select from '#lib/components/ui/select/index.js';
	import { currency, offered, pageLocale } from '#lib/currency.svelte.js';

	// Nothing to pick from until the business offers a second currency.
	let { class: className }: { class?: string } = $props();

	onMount(() => currency.load());

	function label(code: string): string {
		const names = new Intl.DisplayNames(pageLocale(), { type: 'currency' });
		return `${code} · ${names.of(code) ?? code}`;
	}
</script>

{#if offered.length > 1}
	<Select.Root type="single" value={currency.current} onValueChange={(code) => currency.set(code)}>
		<Select.Trigger class={className} aria-label="Currency">{currency.current}</Select.Trigger>
		<Select.Content>
			{#each offered as code (code)}
				<Select.Item value={code}>{label(code)}</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
{/if}
