import fs from "node:fs";
import dedent from "dedent";
import { Project, SyntaxKind } from "ts-morph";

export function modifyLayoutServer(layoutServerPath: string) {
  if (!fs.existsSync(layoutServerPath)) {
    const snippet = dedent`
      export const load = async ({ locals, depends }) => {
        const user = locals.pb.authStore.record!;
        const team = locals.team;
        const teams = await locals.pb.collection("teams").getFullList();
        depends("app:team");

        const breadcrumbs = [{ title: "Home", url: "/dashboard" }];
        return { user, team, teams, breadcrumbs };
      };
    `;

    fs.writeFileSync(layoutServerPath, snippet);
    return;
  }

  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(layoutServerPath);

  const addProperty = (
    obj: import("ts-morph").ObjectLiteralExpression,
    name: string,
    initializer: string,
  ) => {
    const hasProperty = !!obj.getProperty(name);
    if (!hasProperty) {
      if (name === initializer) {
        obj.addShorthandPropertyAssignment({ name });
      } else {
        obj.addPropertyAssignment({ name, initializer });
      }
    }
  };

  let loadArrow: import("ts-morph").ArrowFunction | undefined;
  let loadFn:
    | import("ts-morph").FunctionDeclaration
    | import("ts-morph").FunctionExpression
    | undefined;

  const varDecl = sourceFile.getVariableDeclaration("load");
  if (varDecl) {
    const vs = varDecl.getFirstAncestorByKind(SyntaxKind.VariableStatement);
    const isExported = !!vs?.hasExportKeyword();
    if (isExported) {
      const directArrow = varDecl.getInitializerIfKind(
        SyntaxKind.ArrowFunction,
      );
      if (directArrow) {
        loadArrow = directArrow;
      } else {
        const init = varDecl.getInitializer();
        if (init) {
          const innerArrow = init.getFirstDescendantByKind(
            SyntaxKind.ArrowFunction,
          );
          if (innerArrow) {
            loadArrow = innerArrow;
          } else {
            const innerFnExpr = init.getFirstDescendantByKind(
              SyntaxKind.FunctionExpression,
            );
            if (innerFnExpr) {
              loadFn = innerFnExpr;
            }
          }
        }
      }
    }
  }

  if (!loadArrow) {
    const maybeFn = sourceFile.getFunction("load");
    if (maybeFn && maybeFn.isExported()) {
      loadFn = maybeFn;
    }
  }

  if (!loadArrow && !loadFn) {
    sourceFile.addFunction({
      isExported: true,
      isAsync: true,
      name: "load",
      parameters: [{ name: "{ locals, depends }" }],
      statements: [
        "const user = locals.pb.authStore.record!;",
        "const team = locals.team;",
        'const teams = await locals.pb.collection("teams").getFullList();',
        'depends("app:team");',
        "",
        'const breadcrumbs = [{ title: "Home", url: "/dashboard" }];',
        "return { user, team, teams, breadcrumbs };",
      ],
    });
    sourceFile.formatText();
    sourceFile.saveSync();
    return;
  }

  const fnLike:
    | import("ts-morph").ArrowFunction
    | import("ts-morph").FunctionDeclaration
    | import("ts-morph").FunctionExpression = (loadArrow ?? loadFn!) as any;

  const params = fnLike.getParameters();
  if (params.length === 0) {
    fnLike.insertParameter(0, { name: "{ locals, depends }" });
  } else {
    const first = params[0];
    const original = first.getStructure();
    const nameNode = first.getNameNode();
    if (nameNode.getKind() === SyntaxKind.ObjectBindingPattern) {
      const obp = nameNode as import("ts-morph").ObjectBindingPattern;
      const hasDepends = obp
        .getElements()
        .some((el) => el.getName() === "depends");
      const hasLocals = obp
        .getElements()
        .some((el) => el.getName() === "locals");

      if (!hasDepends) {
        const parts = obp
          .getElements()
          .map((el) => el.getText())
          .filter(Boolean);
        const tail = parts.length > 0 ? ", " + parts.join(", ") : "";

        if (hasLocals) {
          first.set({
            name: `{ depends${tail} }`,
            type: original.type,
            initializer: (original as any).initializer,
          });
        } else {
          first.set({
            name: `{ locals, depends${tail} }`,
            type: original.type,
            initializer: (original as any).initializer,
          });
        }
      }
    } else {
      const currentName = first.getName();
      if (currentName !== "locals") {
        first.set({
          name: `{ locals, depends, ...${currentName} }`,
          type: original.type,
          initializer: (original as any).initializer,
        });
      } else {
        first.set({
          name: `{ locals, depends }`,
          type: original.type,
          initializer: (original as any).initializer,
        });
      }
    }
  }

  if (loadArrow && !loadArrow.isAsync()) {
    loadArrow.setIsAsync(true);
  } else if (loadFn && !loadFn.isAsync()) {
    loadFn.setIsAsync(true);
  }

  const body = fnLike.getBody();
  if (body && body.getKind() === SyntaxKind.Block) {
    const blockBody = body as import("ts-morph").Block;
    const statements = blockBody.getStatements();

    const hasTeam = statements.some(
      (stmt: import("ts-morph").Statement) =>
        stmt.getKind() === SyntaxKind.VariableStatement &&
        stmt
          .getDescendantsOfKind(SyntaxKind.Identifier)
          .some((id: import("ts-morph").Identifier) => id.getText() === "team"),
    );

    const hasTeams = statements.some(
      (stmt: import("ts-morph").Statement) =>
        stmt.getKind() === SyntaxKind.VariableStatement &&
        stmt
          .getDescendantsOfKind(SyntaxKind.Identifier)
          .some(
            (id: import("ts-morph").Identifier) => id.getText() === "teams",
          ),
    );

    const hasDependsTeam = statements.some(
      (stmt: import("ts-morph").Statement) =>
        stmt.getKind() === SyntaxKind.ExpressionStatement &&
        stmt
          .getDescendantsOfKind(SyntaxKind.CallExpression)
          .some((ce: import("ts-morph").CallExpression) => {
            const expr = ce.getExpression();
            if (expr.getText() !== "depends") return false;
            const args = ce.getArguments();
            const argText = args[0]?.getText() ?? "";
            return (
              args.length === 1 &&
              (argText === "'app:team'" || argText === '"app:team"')
            );
          }),
    );

    if (!hasTeam) {
      blockBody.insertStatements(1, "const team = locals.team;");
    }

    if (!hasTeams) {
      blockBody.insertStatements(
        2,
        'const teams = await locals.pb.collection("teams").getFullList();',
      );
    }

    if (!hasDependsTeam) {
      blockBody.insertStatements(3, 'depends("app:team");');
    }
  }

  if (loadArrow) {
    const body = loadArrow.getBody();
    if (body.getKind() === SyntaxKind.Block) {
      const returns = body.getDescendantsOfKind(SyntaxKind.ReturnStatement);
      returns.forEach((ret) => {
        const expr = ret.getExpression();
        if (!expr) return;
        if (expr.getKind() === SyntaxKind.ObjectLiteralExpression) {
          const obj = expr as import("ts-morph").ObjectLiteralExpression;
          addProperty(obj, "team", "team");
          addProperty(obj, "teams", "teams");
        } else if (expr.getKind() === SyntaxKind.ParenthesizedExpression) {
          const inner = (
            expr as import("ts-morph").ParenthesizedExpression
          ).getExpression();
          if (inner.getKind() === SyntaxKind.ObjectLiteralExpression) {
            const obj = inner as import("ts-morph").ObjectLiteralExpression;
            addProperty(obj, "team", "team");
            addProperty(obj, "teams", "teams");
          }
        }
      });
    } else {
      const bodyExpr = body as import("ts-morph").Expression;
      if (bodyExpr.getKind() === SyntaxKind.ParenthesizedExpression) {
        const inner = (
          bodyExpr as import("ts-morph").ParenthesizedExpression
        ).getExpression();
        if (inner.getKind() === SyntaxKind.ObjectLiteralExpression) {
          const obj = inner as import("ts-morph").ObjectLiteralExpression;
          addProperty(obj, "team", "team");
          addProperty(obj, "teams", "teams");
        }
      } else if (bodyExpr.getKind() === SyntaxKind.ObjectLiteralExpression) {
        const obj = bodyExpr as import("ts-morph").ObjectLiteralExpression;
        addProperty(obj, "team", "team");
        addProperty(obj, "teams", "teams");
      }
    }
  } else if (loadFn) {
    const fnBody = loadFn.getBody();
    if (fnBody) {
      const returns = fnBody.getDescendantsOfKind(SyntaxKind.ReturnStatement);
      returns.forEach((ret) => {
        const expr = ret.getExpression();
        if (!expr) return;
        if (expr.getKind() === SyntaxKind.ObjectLiteralExpression) {
          const obj = expr as import("ts-morph").ObjectLiteralExpression;
          addProperty(obj, "team", "team");
          addProperty(obj, "teams", "teams");
        } else if (expr.getKind() === SyntaxKind.ParenthesizedExpression) {
          const inner = (
            expr as import("ts-morph").ParenthesizedExpression
          ).getExpression();
          if (inner.getKind() === SyntaxKind.ObjectLiteralExpression) {
            const obj = inner as import("ts-morph").ObjectLiteralExpression;
            addProperty(obj, "team", "team");
            addProperty(obj, "teams", "teams");
          }
        }
      });
    }
  }

  sourceFile.formatText();
  sourceFile.saveSync();
}
