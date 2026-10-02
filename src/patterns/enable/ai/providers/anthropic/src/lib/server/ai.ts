import { createAnthropic } from '@ai-sdk/anthropic';
import { ANTHROPIC_API_KEY } from '$app/env/private';

/** The `.env` key holding the Anthropic API key, named in the endpoint's 503. */
export const API_KEY = 'ANTHROPIC_API_KEY';

/**
 * The model the AI routes talk to, or `undefined` while ANTHROPIC_API_KEY is
 * blank. The key is read when the server starts, so a new value in `.env`
 * takes a restart, not a code change. Any id from
 * https://docs.claude.com/en/docs/about-claude/models works in place of this
 * one.
 */
export function languageModel() {
	const apiKey = ANTHROPIC_API_KEY;
	return apiKey ? createAnthropic({ apiKey })('claude-sonnet-5') : undefined;
}
