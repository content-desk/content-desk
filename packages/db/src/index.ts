import { env } from "@content-desk/env/server";
import { drizzle } from "drizzle-orm/node-postgres";

import { authSchema } from "./schema/auth";

export function createDb() {
  return drizzle(env.DATABASE_URL, { schema: authSchema });
}

export const db = createDb();
