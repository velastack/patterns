import { describe, it, expect } from "vitest";
import type { Match } from "@velastack/kit";
import type { RouteId } from "./$types";

describe("GET /welcome", () => {
  it("should redirect a signed out visitor to login", async (context) => {
    const response = await context.request.get(
      "/welcome" satisfies Match<RouteId>,
    );
    expect(response.status).toBe(303);
    expect(response.headers.location).toBe("/login");
  });

  it("should ask a signed in user for their name", async (context) => {
    await context.agent.authenticateUser();
    const response = await context.agent.get(
      "/welcome" satisfies Match<RouteId>,
    );
    expect(response.status).toBe(200);
  });
});
