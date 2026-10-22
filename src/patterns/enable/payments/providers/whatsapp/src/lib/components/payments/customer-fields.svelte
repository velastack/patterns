<script lang="ts">
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';

	/** Who is ordering: what the business needs to follow up an order whose chat was never sent. */
	let { disabled = false }: { disabled?: boolean } = $props();
</script>

<div class="grid gap-2">
	<Label for="order-name">Name</Label>
	<Input id="order-name" name="name" autocomplete="name" required {disabled} />
</div>
<div class="grid gap-2">
	<Label for="order-phone">Phone</Label>
	<Input id="order-phone" name="phone" type="tel" autocomplete="tel" required {disabled} />
</div>
<div class="grid gap-2">
	<Label for="order-note">Note (optional)</Label>
	<Textarea id="order-note" name="note" rows={2} {disabled} />
</div>
<!-- A person never sees this; a bot that fills it is dropped by the hosted form. -->
<input type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true" class="hidden" />
