import { describe, it, expect, beforeEach } from "vitest";
import type { Match } from "@velastack/pocketbase";
import { createApiKey } from "./create-api-key";
import type { RouteId } from "./$types";

describe("GET /api-keys/new", () => {
  beforeEach(async (context) => {
    await context.agent.authenticateUser();
  });

  it("should return a 200 status code", async (context) => {
    const response = await context.agent.get(
      "/api-keys/new" satisfies Match<RouteId>,
    );
    expect(response.status).toBe(200);
  });
});

describe("POST /api-keys/new", () => {
  beforeEach(async (context) => {
    await context.agent.authenticateUser();
  });

  it("should create a new API key", async (context) => {
    const response = await context.agent
      .post("/api-keys/new")
      .type("form")
      .send({ label: "Test API Key" });
    expect(response.body.status).toBe(303);
    expect(response.body.location).toBe("/api-keys");
  });
});

describe("api keys authenticate as a user", () => {
  it("should create a new api key", async (context) => {
    const apiKey = await createApiKey(
      context.pb,
      context.user.id,
      "Test API Key",
    );
    expect(apiKey).toBeDefined();
  });

  it("should throw an error when creating for a non-existent user", async (context) => {
    await expect(async () => {
      await createApiKey(context.pb, "non-existent-user-id", "Test API Key");
    }).rejects.toThrow();
  });

  it("should give access to the api", async (context) => {
    const response = await context.request.get(
      `/api/collections/users/records/${context.user.id}`,
    );
    expect(response.status).toBe(404);

    const apiKey = await createApiKey(
      context.pb,
      context.user.id,
      "Test API Key",
    );
    const response2 = await context.request
      .get(`/api/collections/users/records/${context.user.id}`)
      .set("Authorization", `Bearer ${apiKey}`);
    expect(response2.status).toBe(200);
  });
});
