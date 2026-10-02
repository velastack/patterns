import { SyntaxKind } from "ts-morph";
import {
  resolveConfigTarget,
  saveTarget,
  type ConfigModifyResult,
} from "../../../../runtime/config-target";

const HINTS = {
  notFound: "No SvelteKit config to revert.",
  failed:
    "Remove the $locales alias from the sveltekit() arg in vite.config by hand.",
};

/**
 * Remove the `$locales` alias enable-i18n wrote before SvelteKit 3, which
 * `sv migrate sveltekit-3` moves into the inline `sveltekit({...})` arg;
 * `alias` goes too once it is empty. Projects enabled since then map
 * `#locales/*` in package.json `imports` instead.
 */
export function unmodifyLocalesAlias(root: string): ConfigModifyResult {
  const res = resolveConfigTarget(root, HINTS);
  // Nothing to revert in a project without a config.
  if (res.status === "not-found") {
    return {
      filePath: res.filePath,
      outcome: { status: "success", changed: false },
    };
  }
  if (res.status === "failed") {
    return {
      filePath: res.filePath,
      outcome: { status: "failed", message: res.message },
    };
  }

  const { target } = res;
  const aliasProp = target.configObject
    .getProperty("alias")
    ?.asKind(SyntaxKind.PropertyAssignment);
  const aliasObj = aliasProp
    ?.getInitializer()
    ?.asKind(SyntaxKind.ObjectLiteralExpression);
  const locales = aliasObj
    ?.getProperties()
    .find((p) => p.getText().replace(/['"]/g, "").startsWith("$locales"));
  if (aliasProp && aliasObj && locales) {
    locales.remove();
    if (aliasObj.getProperties().length === 0) aliasProp.remove();
  }
  return { filePath: target.filePath, outcome: saveTarget(target) };
}
