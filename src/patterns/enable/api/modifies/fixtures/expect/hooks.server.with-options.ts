import { handlePocketbase } from "@velastack/pocketbase";

export const handle = handlePocketbase({
  pocketbaseUrl: "http://127.0.0.1:8090",
  api: { enabled: true },
});
