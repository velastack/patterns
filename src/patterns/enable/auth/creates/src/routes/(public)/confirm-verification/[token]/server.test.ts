import { describe, it, expect } from "vitest";
import type { Match } from "@velastack/pocketbase";
import type { RouteId } from "./$types";

describe("GET /confirm-verification/[token]", () => {
  it("should redirect if the token is invalid", async (context) => {
    const response = await context.request.get(
      "/confirm-verification/123456" satisfies Match<RouteId>,
    );
    expect(response.status).toBe(303);
    expect(response.headers["location"]).toBe("/login");
  });
});
