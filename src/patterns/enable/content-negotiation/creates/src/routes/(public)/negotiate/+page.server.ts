import { negotiate } from "$lib/negotiate";

export const load = async ({ locals }) => {
  const message = "Hello, content negotiation!";

  return {
    message,
    ...negotiate(locals, {
      "text/markdown": () => `# ${message}`,
    }),
  };
};
