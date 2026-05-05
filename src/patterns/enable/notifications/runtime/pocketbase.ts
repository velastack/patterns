import type { CollectionRulesPatch } from "../../../../core/types";

/**
 * Applied after the notifications collection is created. The update rule
 * restricts non-superuser writes to flipping `read`: any attempt to set
 * `user`, `title`, or `body` in the request body is rejected, so users can
 * mark their own notifications read but can't tamper with content.
 */
export const NOTIFICATION_RULE_PATCHES: CollectionRulesPatch[] = [
  {
    collectionName: "notifications",
    listRule: "user = @request.auth.id",
    viewRule: "user = @request.auth.id",
    createRule: null,
    updateRule:
      "user = @request.auth.id && @request.body.user:isset = false && @request.body.title:isset = false && @request.body.body:isset = false",
    deleteRule: "user = @request.auth.id",
  },
];
