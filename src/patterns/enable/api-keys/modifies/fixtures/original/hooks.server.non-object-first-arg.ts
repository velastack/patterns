import { handlePocketbase } from "@velastack/pocketbase";

const options = { pocketbaseUrl: "http://127.0.0.1:8090" };
export const handle = handlePocketbase(options);
