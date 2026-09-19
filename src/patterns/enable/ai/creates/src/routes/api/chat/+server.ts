import { text } from '@sveltejs/kit';
import { dev } from '$app/environment';
import {
	convertToModelMessages,
	createUIMessageStreamResponse,
	safeValidateUIMessages,
	streamText,
	toUIMessageStream
} from 'ai';
import { API_KEY, languageModel } from '$lib/server/ai';
import type { RequestHandler } from './$types';

// Sent ahead of every conversation: give the assistant its role here.
const INSTRUCTIONS = 'You are a helpful assistant. Keep answers short unless asked for detail.';

/**
 * Where `new Chat()` from @ai-sdk/svelte posts by default: the conversation so
 * far comes in, the model's reply streams back. Anyone who can reach the site
 * can call it, and every reply is billed to your API key, so put it behind
 * sign-in or a rate limit before you deploy.
 *
 * Errors are plain text, which `Chat` shows as `chat.error.message`.
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	const messages = await safeValidateUIMessages({ messages: body?.messages });
	if (!messages.success) {
		return text('Expected a JSON body with a messages array.', { status: 400 });
	}

	const model = languageModel();
	if (!model) {
		return text(`Set ${API_KEY} in .env to start chatting.`, { status: 503 });
	}

	const result = streamText({
		model,
		instructions: INSTRUCTIONS,
		messages: await convertToModelMessages(messages.data)
	});

	return createUIMessageStreamResponse({
		stream: toUIMessageStream({
			stream: result.stream,
			// Provider errors (a bad key, an unknown model id) reach the chat in
			// dev only; in production they stay in the server log.
			onError: (error) =>
				dev && error instanceof Error ? error.message : 'The model could not answer.'
		})
	});
};
