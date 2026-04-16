import type { CollectionRulesPatch } from "../../../core/types";

/** Applied after all team collections are created (create-time rules are omitted). */
export const TEAM_RULE_PATCHES: CollectionRulesPatch[] = [
  {
    collectionName: "teams",
    listRule:
      "team_memberships_via_team.user ?= @request.auth.id || owner = @request.auth.id",
    viewRule: '@request.auth.id != ""',
    createRule: "owner = @request.auth.id",
    updateRule: "owner = @request.auth.id",
    deleteRule: "owner = @request.auth.id",
  },
  {
    collectionName: "team_memberships",
    listRule:
      "user = @request.auth.id || team.team_memberships_via_team.user ?= @request.auth.id",
    viewRule:
      "user = @request.auth.id || team.team_memberships_via_team.user ?= @request.auth.id",
    createRule: null,
    updateRule:
      "((team.team_memberships_via_team.role ?= 'owner' || team.team_memberships_via_team.role ?= 'admin') && team.team_memberships_via_team.user ?= @request.auth.id)",
    deleteRule:
      "user = @request.auth.id || ((team.team_memberships_via_team.role ?= 'owner' || team.team_memberships_via_team.role ?= 'admin') && team.team_memberships_via_team.user ?= @request.auth.id)",
  },
  {
    collectionName: "team_users",
    listRule:
      "id = @request.auth.id || team.team_memberships_via_team.user ?= @request.auth.id",
    viewRule:
      "id = @request.auth.id || team.team_memberships_via_team.user ?= @request.auth.id",
    createRule: null,
    updateRule: null,
    deleteRule: null,
  },
  {
    collectionName: "team_invites",
    listRule:
      "email = @request.auth.email || ((team.team_memberships_via_team.role ?= 'owner' || team.team_memberships_via_team.role ?= 'admin') && team.team_memberships_via_team.user ?= @request.auth.id)",
    viewRule:
      "email = @request.auth.email || ((team.team_memberships_via_team.role ?= 'owner' || team.team_memberships_via_team.role ?= 'admin') && team.team_memberships_via_team.user ?= @request.auth.id)",
    createRule:
      "((team.team_memberships_via_team.role ?= 'owner' || team.team_memberships_via_team.role ?= 'admin') && team.team_memberships_via_team.user ?= @request.auth.id)",
    updateRule: null,
    deleteRule:
      "((team.team_memberships_via_team.role ?= 'owner' || team.team_memberships_via_team.role ?= 'admin') && team.team_memberships_via_team.user ?= @request.auth.id)",
  },
  {
    collectionName: "team_invite_links",
    listRule: null,
    viewRule: '@request.auth.id != ""',
    createRule: null,
    updateRule: null,
    deleteRule: null,
  },
];
