import { describe, expect, it } from "vitest";
import {
  testFixtureUrl,
  urlJsExpr,
  urlJsExprWithSuffix,
  urlSvelteAttrValue,
} from "./url";

describe("urlJsExpr", () => {
  it("returns a quoted string for static URLs", () => {
    expect(urlJsExpr("/projects", [])).toBe('"/projects"');
  });

  it("returns a template literal that interpolates dynamic params", () => {
    expect(urlJsExpr("/[team_id]/projects", ["team_id"])).toBe(
      "`/${params.team_id}/projects`",
    );
  });

  it("interpolates multiple dynamic params", () => {
    expect(
      urlJsExpr("/[org]/teams/[team_id]/projects", ["org", "team_id"]),
    ).toBe("`/${params.org}/teams/${params.team_id}/projects`");
  });

  it("uses a custom param source", () => {
    expect(urlJsExpr("/[id]/foo", ["id"], "event.params")).toBe(
      "`/${event.params.id}/foo`",
    );
  });
});

describe("urlJsExprWithSuffix", () => {
  it("always returns a template literal even for static URLs", () => {
    expect(urlJsExprWithSuffix("/projects", [], "/${id}")).toBe(
      "`/projects/${id}`",
    );
  });

  it("composes dynamic params with a JS template-literal suffix", () => {
    expect(
      urlJsExprWithSuffix("/[team_id]/projects", ["team_id"], "/${id}"),
    ).toBe("`/${params.team_id}/projects/${id}`");
  });
});

describe("urlSvelteAttrValue", () => {
  it("returns a quoted string attribute (incl. `=`) for static URLs", () => {
    expect(urlSvelteAttrValue("/projects", [])).toBe('="/projects"');
  });

  it("returns a Svelte expression with template literal for dynamic URLs", () => {
    expect(urlSvelteAttrValue("/[team_id]/projects", ["team_id"])).toBe(
      "={`/${params.team_id}/projects`}",
    );
  });

  it("appends a static suffix as part of the quoted attribute", () => {
    expect(urlSvelteAttrValue("/projects", [], "/{params.id}")).toBe(
      '="/projects/{params.id}"',
    );
  });

  it("converts Svelte mustache suffix to JS interpolation in dynamic mode", () => {
    expect(
      urlSvelteAttrValue("/[team_id]/projects", ["team_id"], "/{params.id}"),
    ).toBe("={`/${params.team_id}/projects/${params.id}`}");
  });

  it("preserves literal ${...} suffix in static attribute", () => {
    // pre-existing convention in scaffold templates
    expect(urlSvelteAttrValue("/projects", [], "/${params.id}")).toBe(
      '="/projects/${params.id}"',
    );
  });

  it("preserves literal ${...} suffix as JS interp in dynamic template literal", () => {
    expect(
      urlSvelteAttrValue("/[team_id]/projects", ["team_id"], "/${params.id}"),
    ).toBe("={`/${params.team_id}/projects/${params.id}`}");
  });
});

describe("testFixtureUrl", () => {
  it("returns the URL unchanged when no dynamic params", () => {
    expect(testFixtureUrl("/projects")).toBe("/projects");
  });

  it("substitutes [name] segments with test_<name> placeholders", () => {
    expect(testFixtureUrl("/[team_id]/projects/[id]/edit")).toBe(
      "/test_team_id/projects/test_id/edit",
    );
  });
});
