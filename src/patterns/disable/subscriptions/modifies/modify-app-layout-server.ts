import fs from "node:fs";
import { Project, QuoteKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import { removeFromLoad } from "../../../../runtime/unmodify-load";
import {
  formatLikeSource,
  removeTopLevelStatementByIdentifier,
} from "../../../../runtime/ts-morph-helpers";

/**
 * Takes out what enable-subscriptions added to the (app) layout load: the
 * `subscription` it loads and returns, and the `loadActiveSubscription`
 * helper. The rest of the load (what other patterns added) stays.
 */
export function unmodifyAppLayoutServer(filePath: string): ModifyOutcome {
  if (!fs.existsSync(filePath)) {
    return { status: "success", changed: false };
  }
  const original = fs.readFileSync(filePath, "utf8");
  if (!original.includes("loadActiveSubscription")) {
    return { status: "success", changed: false };
  }

  const fromLoad = removeFromLoad(filePath, {
    variables: ["subscription"],
    dependsKeys: [],
    returnProps: ["subscription"],
  });
  if (fromLoad.status !== "success") return fromLoad;

  const project = new Project({
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sf = project.addSourceFileAtPath(filePath);
  removeTopLevelStatementByIdentifier(sf, "loadActiveSubscription");
  formatLikeSource(sf);
  sf.saveSync();

  return {
    status: "success",
    changed: fs.readFileSync(filePath, "utf8") !== original,
  };
}
