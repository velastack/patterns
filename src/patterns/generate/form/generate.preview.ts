import { Options, Result } from "../../../core/types";

export async function generate(options: Options) {
  const { argv } = options;

  return {
    creates: [],
    modifies: [],
    deletes: [],
    components: [],
    packages: [],
  } satisfies Result;
}
