import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Match } from "@velastack/pocketbase";
import * as devalue from "devalue";
import type { RouteId } from "./$types";

let team: { id: string; name: string; owner: string };

beforeEach(async (context) => {
  await context.agent.authenticateUser();
});

afterEach(async (context) => {
  try {
    await context.admin.collection("teams").delete(team.id);
  } catch {}
});

describe("GET /teams/new", () => {
  it("authenticated user should be able to access new team page", async (context) => {
    const response = await context.agent.get(
      "/teams/new" satisfies Match<RouteId>,
    );
    expect(response.status).toBe(200);
  });
});

describe("POST /teams/new", () => {
  it("authenticated user should be able to create team with valid name", async (context) => {
    const teamName = `Test Team ${Math.random().toString(36).slice(2)}`;

    await context.agent
      .post("/teams/new" satisfies Match<RouteId>)
      .type("form")
      .send({
        name: teamName,
      });

    // Verify team was created
    const teams = await context.admin.collection("teams").getList(1, 1, {
      filter: `owner = "${context.user.id}" && name = "${teamName}"`,
    });
    expect(teams.items).toHaveLength(1);
    team = teams.items[0];
    expect(team.name).toBe(teamName);
    expect(team.owner).toBe(context.user.id);

    // Verify team membership was created
    const memberships = await context.admin
      .collection("team_memberships")
      .getList(1, 1, {
        filter: `user = "${context.user.id}" && team = "${team.id}"`,
      });
    expect(memberships.items).toHaveLength(1);
    expect(memberships.items[0].role).toBe("owner");
  });

  it("should return 400 for empty name", async (context) => {
    const response = await context.agent
      .post("/teams/new" satisfies Match<RouteId>)
      .type("form")
      .send({
        name: "",
      });

    const data = devalue.parse(response.body.data);
    expect(data.form.valid).toBe(false);
  });

  it("should return 400 for missing name", async (context) => {
    const response = await context.agent
      .post("/teams/new" satisfies Match<RouteId>)
      .type("form")
      .send({});

    const data = devalue.parse(response.body.data);
    expect(data.form.valid).toBe(false);
  });
});
