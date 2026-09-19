<script lang="ts">
	import { Chat } from '@ai-sdk/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';

	// Posts to /api/chat (src/routes/api/chat/+server.ts) and streams the reply
	// into `chat.messages`. This page is a demo, and it is yours to delete.
	const chat = new Chat({});

	let input = $state('');
	const busy = $derived(chat.status === 'submitted' || chat.status === 'streaming');

	function send(event: SubmitEvent) {
		event.preventDefault();
		const text = input.trim();
		if (!text || busy) return;
		chat.sendMessage({ text });
		input = '';
	}

	// Enter sends; Shift+Enter starts a new line.
	function onkeydown(event: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) {
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			event.currentTarget.form?.requestSubmit();
		}
	}
</script>

<div class="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
	<div>
		<h1 class="text-2xl font-semibold">AI chat</h1>
		<p class="text-muted-foreground text-sm">
			Replies stream from <code>src/routes/api/chat/+server.ts</code>. Pick the model in
			<code>src/lib/server/ai.ts</code>.
		</p>
	</div>

	<div class="flex flex-1 flex-col gap-4" aria-live="polite">
		{#each chat.messages as message (message.id)}
			<div
				class={message.role === 'user'
					? 'bg-primary text-primary-foreground ml-auto max-w-[80%] rounded-lg px-4 py-2'
					: 'max-w-[80%]'}
			>
				{#each message.parts as part, index (index)}
					{#if part.type === 'text'}
						<p class="whitespace-pre-wrap">{part.text}</p>
					{/if}
				{/each}
			</div>
		{:else}
			<p class="text-muted-foreground">Ask anything to start the conversation.</p>
		{/each}

		{#if chat.status === 'submitted'}
			<p class="text-muted-foreground text-sm">Thinking…</p>
		{/if}

		{#if chat.error}
			<div
				role="alert"
				class="border-destructive text-destructive flex items-center justify-between gap-4 rounded-md border px-4 py-2 text-sm"
			>
				<span>{chat.error.message}</span>
				<Button variant="outline" size="sm" onclick={() => chat.regenerate()}>Retry</Button>
			</div>
		{/if}
	</div>

	<form onsubmit={send} class="bg-background sticky bottom-0 flex items-end gap-2 py-2">
		<Textarea
			bind:value={input}
			{onkeydown}
			rows={1}
			placeholder="Send a message"
			aria-label="Message"
			class="max-h-40 min-h-10 resize-none"
		/>
		{#if busy}
			<Button type="button" variant="outline" onclick={() => chat.stop()}>Stop</Button>
		{:else}
			<Button type="submit" disabled={!input.trim()}>Send</Button>
		{/if}
	</form>
</div>
