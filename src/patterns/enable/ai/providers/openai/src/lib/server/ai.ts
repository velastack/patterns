import { createOpenAI } from '@ai-sdk/openai';
import { env } from '$env/dynamic/private';

/** The `.env` key holding the OpenAI API key. */
export const API_KEY = 'OPENAI_API_KEY';

/**
 * The model the AI routes talk to, or `undefined` while OPENAI_API_KEY is
 * blank. The key is read on every call, so a new value in `.env` needs no code
 * change. Any id from https://platform.openai.com/docs/models works in place of
 * this one.
 */
export function languageModel() {
	const apiKey = env[API_KEY];
	return apiKey ? createOpenAI({ apiKey })('gpt-5.5') : undefined;
}
