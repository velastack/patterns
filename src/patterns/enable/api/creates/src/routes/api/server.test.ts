import { describe, expect, it } from "vitest";

describe("GET /api/health", () => {
  it("should return a 200 status code", async (context) => {
    const response = await context.request.get("/api/health");
    expect(response.status).toBe(200);
  });
});
