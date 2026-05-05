<script lang="ts">
	let { children } = $props();
</script>

<div class="dashboard">
	<main>
		{@render children?.()}
	</main>
</div>
