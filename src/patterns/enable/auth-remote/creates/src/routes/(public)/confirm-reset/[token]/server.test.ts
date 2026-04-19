import { describe, it, expect } from "vitest";
import type { Match } from "@velastack/pocketbase";
import type { RouteId } from "./$types";

describe("GET /confirm-reset/[token]", () => {
  it("should render the confirm-reset page", async (context) => {
    const response = await context.request.get(
      "/confirm-reset/123456" satisfies Match<RouteId>,
    );
    expect(response.status).toBe(200);
  });
});
