import { Options, Result } from "../../../core/types";

export async function generate(options: Options) {
  const { root, argv, input } = options;

  return {
    creates: [],
    modifies: [],
    deletes: [],
    components: [],
    packages: [],
  } satisfies Result;
}
