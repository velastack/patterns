import { createAnthropic } from '@ai-sdk/anthropic';
import { env } from '$env/dynamic/private';

/** The `.env` key holding the Anthropic API key. */
export const API_KEY = 'ANTHROPIC_API_KEY';

/**
 * The model the AI routes talk to, or `undefined` while ANTHROPIC_API_KEY is
 * blank. The key is read on every call, so a new value in `.env` needs no code
 * change. Any id from https://docs.claude.com/en/docs/about-claude/models works
 * in place of this one.
 */
export function languageModel() {
	const apiKey = env[API_KEY];
	return apiKey ? createAnthropic({ apiKey })('claude-sonnet-5') : undefined;
}
