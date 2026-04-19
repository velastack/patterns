import { describe, it, expect } from "vitest";
import type { Match } from "@velastack/pocketbase";
import type { RouteId } from "./$types";

describe("POST /logout", () => {
  it("should logout the user", async (context) => {
    await context.agent.authenticateUser();
    const response = await context.agent.post(
      "/logout" satisfies Match<RouteId>,
    );
    expect(response.status).toBe(303);
    expect(response.headers.location).toBe("/");
  });
});
