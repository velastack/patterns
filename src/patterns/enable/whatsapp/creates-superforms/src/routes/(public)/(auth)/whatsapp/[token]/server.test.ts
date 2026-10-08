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

describe("POST /whatsapp/[token]", () => {
  it("should throw an error if the code is invalid", async (context) => {
    const response = await context.agent
      .post("/whatsapp/123456" satisfies Match<RouteId>)
      .type("form")
      .send({ otp: "123456" });
    expect(response.body.status).toBe(400);
  });
});
