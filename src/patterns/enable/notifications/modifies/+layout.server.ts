import fs from "node:fs";
import dedent from "dedent";
import { Project, SyntaxKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";

const FETCH_STATEMENT = dedent`
  const notificationsList = await locals.pb
    .collection("notifications")
    .getList(1, 5, {
      filter: \`user = "\${locals.pb.authStore.record!.id}" && read = false\`,
      sort: "-created",
    });
`;

const NOTIFICATIONS_STATEMENT =
  'const notifications = { count: notificationsList.totalItems, items: notificationsList.items };';

const DEPENDS_STATEMENT = 'depends("app:notifications");';

export function modifyLayoutServer(layoutServerPath: string): ModifyOutcome {
  if (!fs.existsSync(layoutServerPath)) {
    const snippet = dedent`
      export const load = async ({ locals, depends }) => {
        ${FETCH_STATEMENT}
        ${NOTIFICATIONS_STATEMENT}
        ${DEPENDS_STATEMENT}
        return { notifications };
      };
    `;
    fs.writeFileSync(layoutServerPath, snippet);
    return { status: "success", changed: true };
  }

  const originalSource = fs.readFileSync(layoutServerPath, "utf8");
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(layoutServerPath);

  const addProperty = (
    obj: import("ts-morph").ObjectLiteralExpression,
    name: string,
    initializer: string,
  ) => {
    if (obj.getProperty(name)) return;
    if (name === initializer) {
      obj.addShorthandPropertyAssignment({ name });
    } else {
      obj.addPropertyAssignment({ name, initializer });
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
    if (vs?.hasExportKeyword()) {
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
            if (innerFnExpr) loadFn = innerFnExpr;
          }
        }
      }
    }
  }

  if (!loadArrow && !loadFn) {
    const maybeFn = sourceFile.getFunction("load");
    if (maybeFn && maybeFn.isExported()) loadFn = maybeFn;
  }

  if (!loadArrow && !loadFn) {
    sourceFile.addFunction({
      isExported: true,
      isAsync: true,
      name: "load",
      parameters: [{ name: "{ locals, depends }" }],
      statements: [
        FETCH_STATEMENT,
        NOTIFICATIONS_STATEMENT,
        DEPENDS_STATEMENT,
        "return { notifications };",
      ],
    });
    sourceFile.formatText();
    sourceFile.saveSync();
    return { status: "success", changed: true };
  }

  const fnLike = (loadArrow ?? loadFn!) as
    | import("ts-morph").ArrowFunction
    | import("ts-morph").FunctionDeclaration
    | import("ts-morph").FunctionExpression;

  // Ensure first param destructures { locals, depends }
  const params = fnLike.getParameters();
  if (params.length === 0) {
    fnLike.insertParameter(0, { name: "{ locals, depends }" });
  } else {
    const first = params[0];
    const original = first.getStructure();
    const nameNode = first.getNameNode();
    if (nameNode.getKind() === SyntaxKind.ObjectBindingPattern) {
      const obp = nameNode as import("ts-morph").ObjectBindingPattern;
      const elementNames = obp.getElements().map((el) => el.getName());
      const hasDepends = elementNames.includes("depends");
      const hasLocals = elementNames.includes("locals");

      if (!hasDepends || !hasLocals) {
        const existingParts = obp
          .getElements()
          .map((el) => el.getText())
          .filter(Boolean);
        const parts: string[] = hasLocals ? [] : ["locals"];
        parts.push(...existingParts);
        if (!hasDepends) parts.push("depends");
        first.set({
          name: `{ ${parts.join(", ")} }`,
          type: original.type,
          initializer: (original as { initializer?: string }).initializer,
        });
      }
    } else {
      const currentName = first.getName();
      if (currentName !== "locals") {
        first.set({
          name: `{ locals, depends, ...${currentName} }`,
          type: original.type,
          initializer: (original as { initializer?: string }).initializer,
        });
      } else {
        first.set({
          name: `{ locals, depends }`,
          type: original.type,
          initializer: (original as { initializer?: string }).initializer,
        });
      }
    }
  }

  if (loadArrow && !loadArrow.isAsync()) loadArrow.setIsAsync(true);
  else if (loadFn && !loadFn.isAsync()) loadFn.setIsAsync(true);

  const body = fnLike.getBody();
  if (body && body.getKind() === SyntaxKind.Block) {
    const blockBody = body as import("ts-morph").Block;
    const statements = blockBody.getStatements();

    const declaresVar = (name: string) =>
      statements.some((stmt) => {
        if (stmt.getKind() !== SyntaxKind.VariableStatement) return false;
        return (stmt as import("ts-morph").VariableStatement)
          .getDeclarations()
          .some((d) => d.getName() === name);
      });

    const hasDependsCall = statements.some(
      (stmt) =>
        stmt.getKind() === SyntaxKind.ExpressionStatement &&
        stmt
          .getDescendantsOfKind(SyntaxKind.CallExpression)
          .some((ce) => {
            if (ce.getExpression().getText() !== "depends") return false;
            const args = ce.getArguments();
            const argText = args[0]?.getText() ?? "";
            return (
              args.length === 1 &&
              (argText === "'app:notifications'" ||
                argText === '"app:notifications"')
            );
          }),
    );

    const hasNotificationsList = declaresVar("notificationsList");
    const hasNotifications = declaresVar("notifications");

    const returnIdx = statements.findIndex(
      (s) => s.getKind() === SyntaxKind.ReturnStatement,
    );
    let insertAt = returnIdx >= 0 ? returnIdx : statements.length;

    if (!hasNotificationsList) {
      blockBody.insertStatements(insertAt, FETCH_STATEMENT);
      insertAt++;
    }
    if (!hasNotifications) {
      blockBody.insertStatements(insertAt, NOTIFICATIONS_STATEMENT);
      insertAt++;
    }
    if (!hasDependsCall) {
      blockBody.insertStatements(insertAt, DEPENDS_STATEMENT);
    }
  }

  const augmentReturnObject = (
    obj: import("ts-morph").ObjectLiteralExpression,
  ) => {
    addProperty(obj, "notifications", "notifications");
  };

  const augmentReturns = (target: import("ts-morph").Node) => {
    const returns = target.getDescendantsOfKind(SyntaxKind.ReturnStatement);
    returns.forEach((ret) => {
      const expr = ret.getExpression();
      if (!expr) return;
      if (expr.getKind() === SyntaxKind.ObjectLiteralExpression) {
        augmentReturnObject(
          expr as import("ts-morph").ObjectLiteralExpression,
        );
      } else if (expr.getKind() === SyntaxKind.ParenthesizedExpression) {
        const inner = (
          expr as import("ts-morph").ParenthesizedExpression
        ).getExpression();
        if (inner.getKind() === SyntaxKind.ObjectLiteralExpression) {
          augmentReturnObject(
            inner as import("ts-morph").ObjectLiteralExpression,
          );
        }
      }
    });
  };

  if (loadArrow) {
    const arrowBody = loadArrow.getBody();
    if (arrowBody.getKind() === SyntaxKind.Block) {
      augmentReturns(arrowBody);
    } else {
      const bodyExpr = arrowBody as import("ts-morph").Expression;
      if (bodyExpr.getKind() === SyntaxKind.ParenthesizedExpression) {
        const inner = (
          bodyExpr as import("ts-morph").ParenthesizedExpression
        ).getExpression();
        if (inner.getKind() === SyntaxKind.ObjectLiteralExpression) {
          augmentReturnObject(
            inner as import("ts-morph").ObjectLiteralExpression,
          );
        }
      } else if (bodyExpr.getKind() === SyntaxKind.ObjectLiteralExpression) {
        augmentReturnObject(
          bodyExpr as import("ts-morph").ObjectLiteralExpression,
        );
      }
    }
  } else if (loadFn) {
    const fnBody = loadFn.getBody();
    if (fnBody) augmentReturns(fnBody);
  }

  sourceFile.formatText();
  sourceFile.saveSync();
  return {
    status: "success",
    changed: sourceFile.getFullText() !== originalSource,
  };
}
