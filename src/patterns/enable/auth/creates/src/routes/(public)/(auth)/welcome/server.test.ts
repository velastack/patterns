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

describe("POST /welcome", () => {
  it("should save the name and follow the redirect", async (context) => {
    await context.agent.authenticateUser();
    const response = await context.agent
      .post("/welcome" satisfies Match<RouteId>)
      .query({ redirect: "/settings" })
      .type("form")
      .send({ name: "  Ada Lovelace " });
    expect(response.body.status).toBe(303);
    expect(response.body.location).toBe("/settings");

    const user = await context.admin.collection("users").getOne(context.user.id);
    expect(user.name).toBe("Ada Lovelace");
  });

  it("should not save a blank name", async (context) => {
    await context.agent.authenticateUser();
    const response = await context.agent
      .post("/welcome" satisfies Match<RouteId>)
      .type("form")
      .send({ name: "  " });
    expect(response.body.status).toBe(400);
  });
});
