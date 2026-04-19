import {
  POCKETBASE_URL,
  POCKETBASE_SUPERUSER_EMAIL,
  POCKETBASE_SUPERUSER_PASSWORD,
} from "$env/static/private";
import { handlePocketbase } from "@velastack/pocketbase";

export const handle = handlePocketbase({
  pocketbaseUrl: POCKETBASE_URL,
  superuserEmail: POCKETBASE_SUPERUSER_EMAIL,
  superuserPassword: POCKETBASE_SUPERUSER_PASSWORD,
  // [!code highlight:1]
  auth: { protectedRoutes: ["/(app)"] },
});
