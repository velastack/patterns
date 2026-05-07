import { describe, expect, it } from "vitest";
import { parseModel, validateModelName, safeVarName } from "./model";
import { parseRoute, scaffoldFilePaths, scaffoldUrls } from "./route";
import { resolveFields, splitFieldDef, parseSelectOptions } from "./fields";
import {
  pickDisplayField,
  collectionIdMap,
  collectionDisplayFieldMap,
  collectionNames,
} from "./collections";
import { generateAuthRule } from "./permissions";
import type { Collection, Model, RelationField, SelectField } from "./types";

const noAuth = {
  features: {
    auth: false,
    api: false,
    apiKeys: false,
    backend: false,
    i18n: false,
    teams: false,
    payments: false,
    blog: false,
    contentNegotiation: false,
  },
};
const withAuth = {
  features: {
    auth: true,
    api: false,
    apiKeys: false,
    backend: false,
    i18n: false,
    teams: false,
    payments: false,
    blog: false,
    contentNegotiation: false,
  },
};
const withTeams = {
  features: {
    auth: true,
    api: false,
    apiKeys: false,
    backend: false,
    i18n: false,
    teams: true,
    payments: false,
    blog: false,
    contentNegotiation: false,
  },
};

// A parent model used across resolveFields tests
const parent: Model = {
  name: "bird",
  pluralName: "birds",
  typeName: "Bird",
  tableName: "birds",
  displayName: "Bird",
  pluralDisplayName: "Birds",
  schemaName: "birdSchema",
};

// ─── parseModel ──────────────────────────────────────────

describe("parseModel", () => {
  it("should parse a simple model", () => {
    expect(parseModel("birds")).toEqual({
      name: "bird",
      pluralName: "birds",
      typeName: "Bird",
      tableName: "birds",
      displayName: "Bird",
      pluralDisplayName: "Birds",
      schemaName: "birdSchema",
    });
  });

  it("should normalize multi-word names", () => {
    expect(parseModel("admin-users")).toEqual({
      name: "adminUser",
      pluralName: "adminUsers",
      typeName: "AdminUser",
      tableName: "admin_users",
      displayName: "Admin User",
      pluralDisplayName: "Admin Users",
      schemaName: "adminUserSchema",
    });
  });
});

// ─── parseRoute / scaffoldFilePaths / scaffoldUrls ───────

describe("parseRoute", () => {
  const birdModel = parseModel("birds");

  it("uses default (public) group for scaffold without auth", () => {
    const route = parseRoute(undefined, birdModel, noAuth, "scaffold");
    expect(route).toEqual({
      fileBase: "src/routes/(public)/birds",
      urlBase: "/birds",
      dynamicParams: [],
    });
  });

  it("uses default (app) group for scaffold with auth", () => {
    const route = parseRoute(undefined, birdModel, withAuth, "scaffold");
    expect(route).toEqual({
      fileBase: "src/routes/(app)/birds",
      urlBase: "/birds",
      dynamicParams: [],
    });
  });

  it("uses singular default for form (not plural)", () => {
    const route = parseRoute(undefined, birdModel, withAuth, "form");
    expect(route.fileBase).toBe("src/routes/(app)/bird");
    expect(route.urlBase).toBe("/bird");
  });

  it("accepts an explicit route with a route group", () => {
    const route = parseRoute(
      "(app)/[team_id]/projects",
      birdModel,
      withAuth,
      "scaffold",
    );
    expect(route).toEqual({
      fileBase: "src/routes/(app)/[team_id]/projects",
      urlBase: "/[team_id]/projects",
      dynamicParams: ["team_id"],
    });
  });

  it("auto-prepends the default route group when missing", () => {
    const route = parseRoute("admin/users", birdModel, withAuth, "scaffold");
    expect(route.fileBase).toBe("src/routes/(app)/admin/users");
    expect(route.urlBase).toBe("/admin/users");
  });

  it("strips multiple route groups from the URL base", () => {
    const route = parseRoute(
      "(app)/(dashboard)/projects",
      birdModel,
      withAuth,
      "scaffold",
    );
    expect(route.urlBase).toBe("/projects");
  });

  it("extracts multiple dynamic params", () => {
    const route = parseRoute(
      "(app)/[team_id]/projects/[project_id]/tasks",
      birdModel,
      withAuth,
      "scaffold",
    );
    expect(route.dynamicParams).toEqual(["team_id", "project_id"]);
  });

  it("rejects routes that start with a slash", () => {
    expect(() =>
      parseRoute("/admin/users", birdModel, withAuth, "scaffold"),
    ).toThrow(/must not start with "\/"/);
  });

  it("rejects routes that include the src/routes prefix", () => {
    expect(() =>
      parseRoute("src/routes/admin", birdModel, withAuth, "scaffold"),
    ).toThrow(/must not start with "src\/routes\/"/);
  });

  it("rejects routes with empty segments", () => {
    expect(() =>
      parseRoute("admin//users", birdModel, withAuth, "scaffold"),
    ).toThrow(/empty segments/);
  });

  it("rejects segments starting with underscore", () => {
    expect(() =>
      parseRoute("_internal/users", birdModel, withAuth, "scaffold"),
    ).toThrow(/must not start with underscore/);
  });

  it("rejects ..", () => {
    expect(() =>
      parseRoute("admin/../users", birdModel, withAuth, "scaffold"),
    ).toThrow(/"\." or "\.\." segments/);
  });
});

describe("scaffoldFilePaths", () => {
  it("derives all CRUD file paths from the route base", () => {
    const route = parseRoute(undefined, parent, withAuth, "scaffold");
    expect(scaffoldFilePaths(route)).toEqual({
      list: "src/routes/(app)/birds",
      new: "src/routes/(app)/birds/new",
      show: "src/routes/(app)/birds/[id]",
      edit: "src/routes/(app)/birds/[id]/edit",
    });
  });

  it("derives paths for an explicit route with dynamic params", () => {
    const route = parseRoute(
      "(app)/[team_id]/projects",
      parent,
      withAuth,
      "scaffold",
    );
    expect(scaffoldFilePaths(route)).toEqual({
      list: "src/routes/(app)/[team_id]/projects",
      new: "src/routes/(app)/[team_id]/projects/new",
      show: "src/routes/(app)/[team_id]/projects/[id]",
      edit: "src/routes/(app)/[team_id]/projects/[id]/edit",
    });
  });
});

describe("scaffoldUrls", () => {
  it("derives all CRUD URLs from the route base", () => {
    const route = parseRoute(undefined, parent, withAuth, "scaffold");
    expect(scaffoldUrls(route)).toEqual({
      list: "/birds",
      new: "/birds/new",
      show: "/birds/[id]",
      edit: "/birds/[id]/edit",
    });
  });

  it("preserves dynamic params in URLs", () => {
    const route = parseRoute(
      "(app)/[team_id]/projects",
      parent,
      withAuth,
      "scaffold",
    );
    expect(scaffoldUrls(route)).toEqual({
      list: "/[team_id]/projects",
      new: "/[team_id]/projects/new",
      show: "/[team_id]/projects/[id]",
      edit: "/[team_id]/projects/[id]/edit",
    });
  });
});

// ─── validateModelName ───────────────────────────────────

describe("validateModelName", () => {
  it("should throw for invalid model name starting with number", () => {
    expect(() => validateModelName("1abc")).toThrow(
      /Model name must start with a letter/,
    );
  });

  it("should not throw for valid model name", () => {
    expect(() => validateModelName("abc")).not.toThrow();
  });

  it("should reject names with a slash (use --route for paths)", () => {
    expect(() => validateModelName("abc/def")).toThrow(
      /Model name must start with a letter/,
    );
  });
});

// ─── safeVarName ─────────────────────────────────────────

describe("safeVarName", () => {
  it("should return the same string if already safe", () => {
    expect(safeVarName("abc")).toBe("abc");
  });

  it("should return aliases for reserved words", () => {
    expect(safeVarName("class")).toBe("class_");
    expect(safeVarName("function")).toBe("fn");
  });

  it("should alias other reserved/special identifiers", () => {
    expect(safeVarName("default")).toBe("default_");
    expect(safeVarName("return")).toBe("return_");
    expect(safeVarName("delete")).toBe("delete_");
    expect(safeVarName("extends")).toBe("extends_");
    expect(safeVarName("super")).toBe("super_");
    expect(safeVarName("new")).toBe("new_");
    expect(safeVarName("type")).toBe("type_");
    expect(safeVarName("interface")).toBe("iface");
    expect(safeVarName("enum")).toBe("enum_");
    expect(safeVarName("await")).toBe("await_");
    expect(safeVarName("async")).toBe("async_");
    expect(safeVarName("arguments")).toBe("args");
    expect(safeVarName("constructor")).toBe("ctor");
    expect(safeVarName("null")).toBe("nullValue");
    expect(safeVarName("true")).toBe("trueValue");
    expect(safeVarName("false")).toBe("falseValue");
  });
});

// ─── splitFieldDef ───────────────────────────────────────

describe("splitFieldDef", () => {
  it("splits simple name:type", () => {
    expect(splitFieldDef("name:text")).toEqual(["name", "text"]);
  });

  it("returns type with required flag intact", () => {
    expect(splitFieldDef("status:select(draft,done)!")).toEqual([
      "status",
      "select(draft,done)!",
    ]);
  });

  it("keeps parentheses content intact", () => {
    expect(splitFieldDef("status:select(draft,done,archived)")).toEqual([
      "status",
      "select(draft,done,archived)",
    ]);
  });

  it("keeps quoted content with commas and colons intact (double quotes)", () => {
    expect(
      splitFieldDef(
        'status:select(draft:"In Progress",done:"Done, Really",todo:"To:Do")',
      ),
    ).toEqual([
      "status",
      'select(draft:"In Progress",done:"Done, Really",todo:"To:Do")',
    ]);
  });

  it("keeps quoted content with commas and colons intact (single quotes)", () => {
    expect(
      splitFieldDef(
        "status:select(draft:'In Progress',done:'Done, Really',todo:'To:Do')",
      ),
    ).toEqual([
      "status",
      "select(draft:'In Progress',done:'Done, Really',todo:'To:Do')",
    ]);
  });

  it("returns empty type when no colon is present", () => {
    expect(splitFieldDef("invalid")).toEqual(["invalid", ""]);
  });
});

// ─── parseSelectOptions ──────────────────────────────────

describe("parseSelectOptions", () => {
  it("should parse simple comma-separated values", () => {
    expect(parseSelectOptions("draft,done,archived")).toEqual([
      { value: "draft", label: "draft" },
      { value: "done", label: "done" },
      { value: "archived", label: "archived" },
    ]);
  });

  it("should parse value:label pairs", () => {
    expect(parseSelectOptions("draft:Draft,done:Done")).toEqual([
      { value: "draft", label: "Draft" },
      { value: "done", label: "Done" },
    ]);
  });

  it("should handle quoted labels with commas and colons", () => {
    expect(
      parseSelectOptions(
        'draft:"In Progress",done:"Done",paused:"Paused, Waiting",todo:"To:Do"',
      ),
    ).toEqual([
      { value: "draft", label: "In Progress" },
      { value: "done", label: "Done" },
      { value: "paused", label: "Paused, Waiting" },
      { value: "todo", label: "To:Do" },
    ]);
  });

  it("should tolerate whitespace around values and labels", () => {
    expect(
      parseSelectOptions(' draft : "In Progress" , done : Done , archived '),
    ).toEqual([
      { value: "draft", label: "In Progress" },
      { value: "done", label: "Done" },
      { value: "archived", label: "archived" },
    ]);
  });
});

// ─── resolveFields ───────────────────────────────────────

describe("resolveFields", () => {
  const usersCollection: Collection = {
    id: "u1",
    name: "users",
    type: "base",
    fields: [],
  };

  it("should parse simple fields correctly", () => {
    const { fields } = resolveFields(
      ["name:text", "age:number", "isAdmin:bool"],
      parent,
      [usersCollection],
      noAuth,
    );
    expect(fields).toEqual([
      { type: "text", name: "name", title: "Name", required: false },
      { type: "number", name: "age", title: "Age", required: false },
      { type: "bool", name: "isAdmin", title: "Is Admin", required: false },
    ]);
  });

  it("should map all primitive types", () => {
    const inputs = [
      "name:text",
      "age:number",
      "isAdmin:bool",
      "birthdate:date",
      "email:email",
      "password:password",
      "website:url",
      "content:editor",
      "updatedAt:autodate",
      "choice:select",
      "avatar:file",
      "meta:json",
      "location:geoPoint",
    ];
    const { fields } = resolveFields(inputs, parent, [], noAuth);
    expect(fields.map((f) => f.type)).toEqual([
      "text",
      "number",
      "bool",
      "date",
      "email",
      "password",
      "url",
      "editor",
      "autodate",
      "select",
      "file",
      "json",
      "geoPoint",
    ]);
  });

  it("should map alias types to canonical types", () => {
    const inputs = [
      "title:string",
      "enabled:boolean",
      "count:int",
      "count2:integer",
      "price:float",
      "ratio:double",
      "amount:decimal",
      "publishedAt:datetime",
      "updatedAt:timestamp",
      "point:geopoint",
      "user:references",
    ];
    const { fields } = resolveFields(inputs, parent, [usersCollection], noAuth);
    expect(fields.map((f) => f.type)).toEqual([
      "text",
      "bool",
      "number",
      "number",
      "number",
      "number",
      "number",
      "date",
      "date",
      "geoPoint",
      "relation",
    ]);
  });

  it("should throw for invalid field name", () => {
    expect(() => resolveFields(["1abc:text"], parent, [], noAuth)).toThrow(
      /Invalid field name/,
    );
  });

  it("should throw for invalid field type", () => {
    expect(() => resolveFields(["title:unknown"], parent, [], noAuth)).toThrow(
      /Invalid field type/,
    );
  });

  it("should throw for invalid field format (missing type)", () => {
    expect(() => resolveFields(["noType"], parent, [], noAuth)).toThrow(
      /Invalid field format/,
    );
  });

  it("should set required on relation fields and keep relation metadata", () => {
    const { fields } = resolveFields(
      ["user:relation!", "users:relation!"],
      parent,
      [usersCollection],
      withAuth,
    );

    const userModel: Model = {
      name: "user",
      pluralName: "users",
      typeName: "User",
      tableName: "users",
      displayName: "User",
      pluralDisplayName: "Users",
      schemaName: "userSchema",
    };

    expect(fields).toEqual([
      {
        type: "relation",
        name: "user",
        title: "User",
        required: true,
        collectionId: "u1",
        maxSelect: 1,
        displayField: "id",
        relatedModel: userModel,
        singularRelationName: "birdUser",
        pluralRelationName: "birdUsers",
        isCurrentUser: false,
        isCurrentTeam: false,
      },
      {
        type: "relation",
        name: "users",
        title: "Users",
        required: true,
        collectionId: "u1",
        maxSelect: 999,
        displayField: "id",
        relatedModel: userModel,
        singularRelationName: "birdUser",
        pluralRelationName: "birdUsers",
        isCurrentUser: false,
        isCurrentTeam: false,
      },
    ]);
  });

  it("should error for relation field when collection does not exist", () => {
    expect(() => resolveFields(["user:relation"], parent, [], noAuth)).toThrow(
      /Invalid relation field/,
    );
  });

  it("should handle relation type with singular and plural field names", () => {
    const { fields } = resolveFields(
      ["user:relation", "users:relation"],
      parent,
      [usersCollection],
      withAuth,
    );
    expect(fields[0].type).toBe("relation");
    expect((fields[0] as RelationField).maxSelect).toBe(1);
    expect(fields[1].type).toBe("relation");
    expect((fields[1] as RelationField).maxSelect).toBe(999);
  });

  it("should infer relation when type equals collection name (plural)", () => {
    const usersWithTitle: Collection = {
      id: "u1",
      name: "users",
      type: "base",
      fields: [{ name: "title", type: "text" }],
    };

    const { fields } = resolveFields(
      ["owner:user", "owners:users"],
      parent,
      [usersWithTitle],
      withAuth,
    );

    expect(fields[0].type).toBe("relation");
    const ownerField = fields[0] as RelationField;
    expect(ownerField.collectionId).toBe("u1");
    expect(ownerField.displayField).toBe("title");
    expect(ownerField.maxSelect).toBe(1);
    expect(ownerField.singularRelationName).toBe("birdUser");
    expect(ownerField.pluralRelationName).toBe("birdUsers");

    expect(fields[1].type).toBe("relation");
    const ownersField = fields[1] as RelationField;
    expect(ownersField.maxSelect).toBe(999);
  });

  it("should parse select options with default label=value", () => {
    const { fields } = resolveFields(
      ["status:select(draft,done,archived)"],
      parent,
      [],
      noAuth,
    );
    const field = fields[0] as SelectField;
    expect(field.type).toBe("select");
    expect(field.options).toEqual([
      { value: "draft", label: "draft" },
      { value: "done", label: "done" },
      { value: "archived", label: "archived" },
    ]);
  });

  it("should parse select options as value:label pairs", () => {
    const { fields } = resolveFields(
      ["status:select(draft:Draft,done:Done)"],
      parent,
      [],
      noAuth,
    );
    const field = fields[0] as SelectField;
    expect(field.options).toEqual([
      { value: "draft", label: "Draft" },
      { value: "done", label: "Done" },
    ]);
  });

  it("should parse quoted labels and preserve commas/colons inside quotes", () => {
    const { fields } = resolveFields(
      [
        'status:select(draft:"In Progress",done:"Done",paused:"Paused, Waiting",todo:"To:Do")',
      ],
      parent,
      [],
      noAuth,
    );
    const field = fields[0] as SelectField;
    expect(field.options).toEqual([
      { value: "draft", label: "In Progress" },
      { value: "done", label: "Done" },
      { value: "paused", label: "Paused, Waiting" },
      { value: "todo", label: "To:Do" },
    ]);
  });

  it("should tolerate whitespace around select values and labels", () => {
    const { fields } = resolveFields(
      ['status:select( draft : "In Progress" , done : Done , archived )'],
      parent,
      [],
      noAuth,
    );
    const field = fields[0] as SelectField;
    expect(field.options).toEqual([
      { value: "draft", label: "In Progress" },
      { value: "done", label: "Done" },
      { value: "archived", label: "archived" },
    ]);
  });

  it("should set required when select has trailing !", () => {
    const { fields } = resolveFields(
      ['status:select(draft:"In Progress",done:"Done")!'],
      parent,
      [],
      noAuth,
    );
    expect(fields[0].required).toBe(true);
    expect(fields[0].type).toBe("select");
  });

  it("should handle autodate fields with create/update", () => {
    const { fields } = resolveFields(
      ["createdAt:autodate", "updatedAt:autodate"],
      parent,
      [],
      noAuth,
    );
    expect(fields[0]).toEqual({
      type: "autodate",
      name: "createdAt",
      title: "Created At",
      required: false,
      onCreate: true,
      onUpdate: false,
    });
    expect(fields[1]).toEqual({
      type: "autodate",
      name: "updatedAt",
      title: "Updated At",
      required: false,
      onCreate: false,
      onUpdate: true,
    });
  });

  it("should throw for invalid autodate field name", () => {
    expect(() =>
      resolveFields(["randomDate:autodate"], parent, [], noAuth),
    ).toThrow(/Invalid autodate field/);
  });

  it("should handle file and files via singular/plural inference", () => {
    const { fields } = resolveFields(
      ["avatar:file", "photos:file"],
      parent,
      [],
      noAuth,
    );
    expect(fields[0].type).toBe("file");
    expect((fields[0] as any).maxSelect).toBe(1);
    expect(fields[1].type).toBe("file");
    expect((fields[1] as any).maxSelect).toBe(99);
  });

  it("should handle 'files' alias type", () => {
    const { fields } = resolveFields(["photos:files"], parent, [], noAuth);
    expect(fields[0].type).toBe("file");
    expect((fields[0] as any).maxSelect).toBe(99);
  });

  it("should handle select maxSelect via singular/plural field name", () => {
    const { fields } = resolveFields(
      ["color:select(red,blue)", "colors:select(red,blue)"],
      parent,
      [],
      noAuth,
    );
    expect((fields[0] as SelectField).maxSelect).toBe(1);
    expect((fields[1] as SelectField).maxSelect).toBe(99);
  });

  it("should generate auth rule when auth is enabled", () => {
    const { auth } = resolveFields(
      ["name:text"],
      parent,
      [usersCollection],
      withAuth,
    );
    expect(auth).toBeDefined();
    expect(auth!.rule).toContain("@request.auth.id");
  });

  it("should not generate auth rule when auth is disabled", () => {
    const { auth } = resolveFields(["name:text"], parent, [], noAuth);
    expect(auth).toBeUndefined();
  });

  it("should handle current_user when auth is enabled", () => {
    const { fields } = resolveFields(
      ["author:current_user"],
      parent,
      [usersCollection],
      withAuth,
    );
    expect(fields[0].type).toBe("relation");
    const field = fields[0] as RelationField;
    expect(field.isCurrentUser).toBe(true);
    expect(field.collectionId).toBe("u1");
    expect(field.maxSelect).toBe(1);
  });

  it("should handle current_team when teams is enabled", () => {
    const teamsCollection: Collection = {
      id: "t1",
      name: "teams",
      type: "base",
      fields: [],
    };
    const { fields } = resolveFields(
      ["team:current_team"],
      parent,
      [usersCollection, teamsCollection],
      withTeams,
    );
    expect(fields[0].type).toBe("relation");
    const field = fields[0] as RelationField;
    expect(field.isCurrentTeam).toBe(true);
    expect(field.isCurrentUser).toBe(false);
    expect(field.collectionId).toBe("t1");
    expect(field.maxSelect).toBe(1);
  });
});

// ─── pickDisplayField ────────────────────────────────────

describe("pickDisplayField", () => {
  it("should pick name over email", () => {
    const fields = [
      { name: "age", type: "text" },
      { name: "email", type: "text" },
      { name: "name", type: "text" },
    ];
    expect(pickDisplayField(fields)).toBe("name");
  });

  it("should pick name over full_name", () => {
    const fields = [
      { name: "full_name", type: "text" },
      { name: "name", type: "text" },
      { name: "label", type: "text" },
    ];
    expect(pickDisplayField(fields)).toBe("name");
  });

  it("should fall back to id when no candidates match", () => {
    const fields = [{ name: "foo", type: "text" }];
    expect(pickDisplayField(fields)).toBe("id");
  });
});

// ─── collectionIdMap ─────────────────────────────────────

describe("collectionIdMap", () => {
  it("should return correct id map", () => {
    const collections: Collection[] = [
      { id: "u1", name: "users", type: "base", fields: [] },
    ];
    expect(collectionIdMap(collections)).toEqual({ users: "u1" });
  });
});

// ─── collectionDisplayFieldMap ───────────────────────────

describe("collectionDisplayFieldMap", () => {
  it("should fall back to id when no display field candidates", () => {
    const collections: Collection[] = [
      { id: "u1", name: "users", type: "base", fields: [] },
    ];
    expect(collectionDisplayFieldMap(collections)).toEqual({ users: "id" });
  });

  it("should pick title as display field", () => {
    const collections: Collection[] = [
      {
        id: "u1",
        name: "users",
        type: "base",
        fields: [{ name: "title", type: "text" }],
      },
    ];
    expect(collectionDisplayFieldMap(collections)).toEqual({
      users: "title",
    });
  });
});

// ─── collectionNames ─────────────────────────────────────

describe("collectionNames", () => {
  it("should exclude system collections", () => {
    const collections: Collection[] = [
      { id: "1", name: "users", type: "base", fields: [] },
      { id: "2", name: "_internal", type: "base", fields: [] },
    ];
    expect(collectionNames(collections)).toEqual(["users"]);
  });
});

// ─── generateAuthRule ────────────────────────────────────

describe("generateAuthRule", () => {
  it("should return self-rule for auth collection", () => {
    const schema: Collection[] = [
      { id: "u1", name: "users", type: "auth", fields: [] },
    ];
    const result = generateAuthRule(schema, "users");
    expect(result.rule).toBe("@request.auth.id = id");
    expect(result.operator).toBe("=");
  });

  it("should find path through relation to users", () => {
    const schema: Collection[] = [
      { id: "u1", name: "users", type: "auth", fields: [] },
      {
        id: "p1",
        name: "posts",
        type: "base",
        fields: [
          {
            name: "author",
            type: "relation",
            collectionId: "u1",
            maxSelect: 1,
          },
        ],
      },
    ];
    const result = generateAuthRule(schema, "posts");
    expect(result.rule).toBe("@request.auth.id = author.id");
    expect(result.ownershipChainFields).toEqual(["author"]);
    expect(result.operator).toBe("=");
  });

  it("should fall back to authenticated-only when no path to auth", () => {
    const schema: Collection[] = [
      { id: "p1", name: "posts", type: "base", fields: [] },
    ];
    const result = generateAuthRule(schema, "posts");
    expect(result.rule).toBe('@request.auth.id != ""');
  });
});
