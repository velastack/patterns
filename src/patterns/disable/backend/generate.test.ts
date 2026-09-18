import { describe, expect, it } from "vitest";
import type { Options } from "../../../core/types";
import { generate } from "./generate";

describe("disable backend pattern", () => {
  it("removes the workflows along with the backend they run on", async () => {
    const result = await generate({} as Options);
    const deleted = result.deletes.map((file) => file.path);

    expect(deleted).toEqual(
      expect.arrayContaining([
        "data",
        "src/hooks.server.ts",
        // The runtime reads `App.Locals["admin"]`, and every workflow module
        // imports `ow` from it: neither type-checks without the backend.
        "src/lib/server/workflows.ts",
        "src/lib/workflows",
      ]),
    );
    expect(result.uninstalls).toEqual([
      "openworkflow",
      "openworkflow-pocketbase",
      "croner",
    ]);
  });
});
