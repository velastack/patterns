import { describe, it, expect, beforeEach } from "vitest";
import type { Match } from "@velastack/pocketbase";
import type { RouteId } from "./$types";

describe("GET /api-keys", () => {
  beforeEach(async (context) => {
    await context.agent.authenticateUser();
  });

  it("should return a 200 status code", async (context) => {
    const response = await context.agent.get(
      "/api-keys" satisfies Match<RouteId>,
    );
    expect(response.status).toBe(200);
  });
});
