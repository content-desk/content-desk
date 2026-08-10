import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const runtimeEnv = (
  import.meta as ImportMeta & {
    env: Record<string, string | undefined>;
  }
).env;

export const env = createEnv({
  client: {
    VITE_SERVER_URL: z.url(),
  },
  clientPrefix: "VITE_",
  emptyStringAsUndefined: true,
  runtimeEnv,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
