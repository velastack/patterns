import { expect } from "vitest";
import prettier from "prettier";
import sveltePlugin from "prettier-plugin-svelte";

async function formatIfPossible(
  content: string,
  filepath: string,
): Promise<string> {
  try {
    return await prettier.format(content, {
      filepath,
      plugins: [sveltePlugin],
    });
  } catch {
    return content;
  }
}

expect.extend({
  async toMatchFormatted(received: string, expected: string, filepath: string) {
    const [formattedReceived, formattedExpected] = await Promise.all([
      formatIfPossible(received, filepath),
      formatIfPossible(expected, filepath),
    ]);
    const pass = formattedReceived === formattedExpected;
    return {
      pass,
      message: () =>
        pass
          ? `expected formatted contents not to match`
          : `expected formatted contents to match`,
      actual: formattedReceived,
      expected: formattedExpected,
    };
  },
});

interface CustomMatchers<R = unknown> {
  toMatchFormatted(expected: string, filepath: string): Promise<R>;
}

declare module "vitest" {
  interface Matchers<T = any> extends CustomMatchers<T> {}
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
