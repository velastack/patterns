import { describe, it, expect } from "vitest";
import type { Match } from "@velastack/kit";
import type { RouteId } from "./$types";

describe("GET /whatsapp/[token]", () => {
  it("should render the code page", async (context) => {
    const response = await context.request.get(
      "/whatsapp/123456" satisfies Match<RouteId>,
    );
    expect(response.status).toBe(200);
  });
});
