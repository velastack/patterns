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
  toMatchFormatted(expected: string, filepath: string): R;
}

// vitest 5 types matchers as `Matchers<R, T>`: R is what the assertion returns
// (`void`, or `Promise<void>` behind `.resolves`), T the received value.
declare module "vitest" {
  interface Matchers<R, T> extends CustomMatchers<R> {}
  interface Assertion<R, T> extends CustomMatchers<R> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
