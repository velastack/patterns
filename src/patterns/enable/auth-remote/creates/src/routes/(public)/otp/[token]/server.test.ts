import { describe, it, expect } from "vitest";
import type { Match } from "@velastack/pocketbase";
import type { RouteId } from "./$types";

describe("GET /otp/[token]", () => {
  it("should render the otp page", async (context) => {
    const response = await context.request.get(
      "/otp/123456" satisfies Match<RouteId>,
    );
    expect(response.status).toBe(200);
  });
});
