import { describe, it, expect } from "vitest";
import type { Match } from "@velastack/pocketbase";
import type { RouteId } from "./$types";

describe("GET /teams", () => {
  it("authenticated user should be able to access the teams page", async (context) => {
    await context.agent.authenticateUser();
    const response = await context.agent.get("/teams" satisfies Match<RouteId>);
    expect(response.status).toBe(200);
  });
});
