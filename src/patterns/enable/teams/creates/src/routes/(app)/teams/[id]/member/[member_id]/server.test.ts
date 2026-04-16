import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Match } from "@velastack/pocketbase";
import * as devalue from "devalue";
import type { RouteId } from "./$types";

let team: { id: string; name: string };
let member: { id: string; user: string; role: string };

beforeEach(async (context) => {
  await context.agent.authenticateUser();

  team = await context.admin.collection("teams").create({
    name: "Test Team",
    owner: context.user.id,
  });

  await context.admin.collection("team_memberships").create({
    team: team.id,
    user: context.user.id,
    role: "owner",
  });

  // Create a test member
  const memberUser = await context.admin.collection("users").create({
    email: `test-${Math.random().toString(36).slice(2)}@example.com`,
    password: "password",
    passwordConfirm: "password",
  });

  member = await context.admin.collection("team_memberships").create({
    team: team.id,
    user: memberUser.id,
    role: "member",
  });
});

afterEach(async (context) => {
  try {
    await context.admin.collection("teams").delete(team.id);
  } catch {}
});

describe("GET /teams/[id]/member/[member_id]", () => {
  it("authenticated user should be able to access member page", async (context) => {
    const response = await context.agent.get(
      `/teams/${team.id}/member/${member.id}` satisfies Match<RouteId>,
    );
    expect(response.status).toBe(200);
  });
});

describe("POST /teams/[id]/member/[member_id]", () => {
  it("owner should be able to update member role", async (context) => {
    await context.agent
      .post(`/teams/${team.id}/member/${member.id}` satisfies Match<RouteId>)
      .type("form")
      .send({
        role: "admin",
      });

    // Verify role was updated
    const updatedMember = await context.admin
      .collection("team_memberships")
      .getOne(member.id);
    expect(updatedMember.role).toBe("admin");
  });

  it("admin should be able to update member role", async (context) => {
    const email = `test-${Math.random().toString(36).slice(2)}@example.com`;
    const password = "password";

    const adminUser = await context.admin.collection("users").create({
      email,
      password,
      passwordConfirm: password,
    });

    await context.admin.collection("team_memberships").create({
      team: team.id,
      user: adminUser.id,
      role: "admin",
    });

    await context.agent.post("/login").type("form").send({
      type: "password",
      email,
      password,
    });

    await context.agent
      .post(`/teams/${team.id}/member/${member.id}` satisfies Match<RouteId>)
      .type("form")
      .send({
        role: "member",
      });

    // Verify role was updated
    const updatedMember = await context.admin
      .collection("team_memberships")
      .getOne(member.id);
    expect(updatedMember.role).toBe("member");

    context.admin.collection("users").delete(adminUser.id);
  });

  it("member should not be able to update member role", async (context) => {
    const email = `test-${Math.random().toString(36).slice(2)}@example.com`;
    const password = "password";

    const memberUser = await context.admin.collection("users").create({
      email,
      password,
      passwordConfirm: password,
    });

    await context.admin.collection("team_memberships").create({
      team: team.id,
      user: memberUser.id,
      role: "member",
    });

    await context.agent.post("/login").type("form").send({
      type: "password",
      email,
      password,
    });

    await context.agent
      .post(`/teams/${team.id}/member/${member.id}` satisfies Match<RouteId>)
      .type("form")
      .send({
        role: "admin",
      });

    // Verify role was not updated
    const unchangedMember = await context.admin
      .collection("team_memberships")
      .getOne(member.id);
    expect(unchangedMember.role).toBe("member");

    context.admin.collection("users").delete(memberUser.id);
  });

  it("should return 400 for invalid role", async (context) => {
    const response = await context.agent
      .post(`/teams/${team.id}/member/${member.id}` satisfies Match<RouteId>)
      .type("form")
      .send({
        role: "invalid-role",
      });

    const data = devalue.parse(response.body.data);
    expect(data.form.valid).toBe(false);
  });

  it("should return 400 for empty role", async (context) => {
    const response = await context.agent
      .post(`/teams/${team.id}/member/${member.id}` satisfies Match<RouteId>)
      .type("form")
      .send({
        role: "",
      });

    const data = devalue.parse(response.body.data);
    expect(data.form.valid).toBe(false);
  });

  it("should return 400 for invalid member ID", async (context) => {
    const response = await context.agent
      .post(`/teams/${team.id}/member/invalid-id` satisfies Match<RouteId>)
      .type("form")
      .send({
        role: "admin",
      });

    const data = devalue.parse(response.body.data);
    expect(data.form.valid).toBe(false);
  });
});
