import { createGateway } from 'ai';
import { AI_GATEWAY_API_KEY } from '$app/env/private';

/** The `.env` key holding the Vercel AI Gateway API key, named in the endpoint's 503. */
export const API_KEY = 'AI_GATEWAY_API_KEY';

/**
 * The model the AI routes talk to, or `undefined` while AI_GATEWAY_API_KEY is
 * blank. The key is read when the server starts, so a new value in `.env`
 * takes a restart, not a code change. The gateway routes `creator/model` ids
 * to their provider; any id from https://vercel.com/ai-gateway/models works in
 * place of this one.
 */
export function languageModel() {
	const apiKey = AI_GATEWAY_API_KEY;
	return apiKey ? createGateway({ apiKey })('anthropic/claude-sonnet-5') : undefined;
}
