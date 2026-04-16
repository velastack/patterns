import { handlePocketbase } from "@velastack/pocketbase";

export const handle = handlePocketbase({
  api: { enabled: true, apiKeys: { enabled: true } },
});
