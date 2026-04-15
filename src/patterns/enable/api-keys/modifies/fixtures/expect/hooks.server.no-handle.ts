import { sequence } from "@sveltejs/kit/hooks";

const first = async ({ event, resolve }: any) => resolve(event);
const second = async ({ event, resolve }: any) => resolve(event);
export const handle = sequence(first, second);
