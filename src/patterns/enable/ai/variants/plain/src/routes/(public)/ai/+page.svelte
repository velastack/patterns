<script lang="ts">
	import { Chat } from '@ai-sdk/svelte';

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

<h1>AI chat</h1>
<p>
	Replies stream from <code>src/routes/api/chat/+server.ts</code>. Pick the model in
	<code>src/lib/server/ai.ts</code>.
</p>

<section aria-live="polite">
	{#each chat.messages as message (message.id)}
		<article data-role={message.role}>
			<strong>{message.role === 'user' ? 'You' : 'Assistant'}</strong>
			{#each message.parts as part, index (index)}
				{#if part.type === 'text'}
					<p style="white-space: pre-wrap">{part.text}</p>
				{/if}
			{/each}
		</article>
	{:else}
		<p>Ask anything to start the conversation.</p>
	{/each}

	{#if chat.status === 'submitted'}
		<p>Thinking…</p>
	{/if}

	{#if chat.error}
		<p role="alert">
			{chat.error.message}
			<button type="button" onclick={() => chat.regenerate()}>Retry</button>
		</p>
	{/if}
</section>

<form onsubmit={send}>
	<textarea bind:value={input} {onkeydown} rows="2" placeholder="Send a message" aria-label="Message"
	></textarea>
	{#if busy}
		<button type="button" onclick={() => chat.stop()}>Stop</button>
	{:else}
		<button type="submit" disabled={!input.trim()}>Send</button>
	{/if}
</form>
