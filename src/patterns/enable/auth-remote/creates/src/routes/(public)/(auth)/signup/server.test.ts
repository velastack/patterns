import { describe, it, expect } from "vitest";
import type { Match } from "@velastack/pocketbase";
import type { RouteId } from "./$types";

describe("GET /signup", () => {
  it("should render the signup page", async (context) => {
    const response = await context.request.get(
      "/signup" satisfies Match<RouteId>,
    );
    expect(response.status).toBe(200);
  });
});
