import { SyntaxKind, type PropertyAssignment } from "ts-morph";
import {
  modifyConfig,
  type ConfigModifyResult,
} from "../../../../runtime/config-target";

const HINTS = {
  notFound: "No SvelteKit config to revert.",
  failed: "Remove the $locales alias from the kit config by hand.",
};

/** Remove the `$locales` alias; drop `alias` too once it is empty. */
export function unmodifySvelteConfig(root: string): ConfigModifyResult {
  const result = modifyConfig(root, HINTS, (target) => {
    const kit = target.kitContainer();
    if (!kit) return true;

    const aliasProp = kit.getProperty("alias");
    if (!aliasProp || aliasProp.getKind() !== SyntaxKind.PropertyAssignment) {
      return true;
    }
    const aliasObj = (aliasProp as PropertyAssignment).getInitializer();
    if (
      !aliasObj ||
      aliasObj.getKind() !== SyntaxKind.ObjectLiteralExpression
    ) {
      return true;
    }
    const obj = aliasObj.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    const locales = obj
      .getProperties()
      .find((p) => p.getText().replace(/['"]/g, "").startsWith("$locales"));
    if (!locales) return true;

    locales.remove();
    if (obj.getProperties().length === 0) {
      aliasProp.remove();
    }
    return true;
  });

  // Nothing to revert in a project without a config.
  if (result.outcome.status === "not-found") {
    return { ...result, outcome: { status: "success", changed: false } };
  }
  return result;
}
