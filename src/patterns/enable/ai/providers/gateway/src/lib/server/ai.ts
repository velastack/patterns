import { createGateway } from 'ai';
import { env } from '$env/dynamic/private';

/** The `.env` key holding the Vercel AI Gateway API key. */
export const API_KEY = 'AI_GATEWAY_API_KEY';

/**
 * The model the AI routes talk to, or `undefined` while AI_GATEWAY_API_KEY is
 * blank. The key is read on every call, so a new value in `.env` needs no code
 * change. The gateway routes `creator/model` ids to their provider; any id from
 * https://vercel.com/ai-gateway/models works in place of this one.
 */
export function languageModel() {
	const apiKey = env[API_KEY];
	return apiKey ? createGateway({ apiKey })('anthropic/claude-sonnet-5') : undefined;
}
