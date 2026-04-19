import { describe, it, expect } from "vitest";
import type { Match } from "@velastack/pocketbase";
import type { RouteId } from "./$types";

describe("GET /login", () => {
  it("should render the login page", async (context) => {
    const response = await context.agent.get("/login" satisfies Match<RouteId>);
    expect(response.status).toBe(200);
  });

  it("should redirect to the dashboard if the user is already authenticated", async (context) => {
    await context.agent.authenticateUser();
    const response = await context.agent.get("/login" satisfies Match<RouteId>);
    expect(response.status).toBe(303);
    expect(response.headers.location).toBe("/dashboard");
  });
});
