import { describe, it, expect } from "vitest";
import * as devalue from "devalue";
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

describe("POST /login", () => {
  it("should login with password", async (context) => {
    const response = await context.agent
      .post("/login" satisfies Match<RouteId>)
      .type("form")
      .send({
        type: "password",
        email: context.user.email,
        password: "password",
      });
    expect(response.body.status).toBe(303);
    expect(response.body.location).toBe("/dashboard");
  });

  it("should error if the password is incorrect", async (context) => {
    const response = await context.agent
      .post("/login" satisfies Match<RouteId>)
      .type("form")
      .send({
        type: "password",
        email: context.user.email,
        password: "incorrect",
      });
    const data = devalue.parse(response.body.data);
    expect(response.body.status).toBe(400);
    expect(data.form.message.text).toBe("Failed to authenticate.");
  });
});
