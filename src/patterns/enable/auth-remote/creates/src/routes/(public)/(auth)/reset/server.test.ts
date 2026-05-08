import { describe, it, expect } from "vitest";
import type { Match } from "@velastack/pocketbase";
import type { RouteId } from "./$types";

describe("GET /reset", () => {
  it("should render the reset page", async (context) => {
    const response = await context.request.get(
      "/reset" satisfies Match<RouteId>,
    );
    expect(response.status).toBe(200);
  });
});
