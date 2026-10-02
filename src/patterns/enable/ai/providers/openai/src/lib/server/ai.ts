import { createOpenAI } from '@ai-sdk/openai';
import { OPENAI_API_KEY } from '$app/env/private';

/** The `.env` key holding the OpenAI API key, named in the endpoint's 503. */
export const API_KEY = 'OPENAI_API_KEY';

/**
 * The model the AI routes talk to, or `undefined` while OPENAI_API_KEY is
 * blank. The key is read when the server starts, so a new value in `.env`
 * takes a restart, not a code change. Any id from
 * https://platform.openai.com/docs/models works in place of this one.
 */
export function languageModel() {
	const apiKey = OPENAI_API_KEY;
	return apiKey ? createOpenAI({ apiKey })('gpt-5.5') : undefined;
}
