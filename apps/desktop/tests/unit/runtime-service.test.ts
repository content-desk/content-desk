import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../../src/main/database/database";
import { Repositories } from "../../src/main/database/repositories";
import { RuntimeService } from "../../src/main/runtimes/runtime-service";

describe("RuntimeService", () => {
  it.skipIf(process.platform === "win32")(
    "probes only a validated executable with fixed version arguments",
    async () => {
      const directory = await mkdtemp(join(tmpdir(), "contentdesk-runtime-"));
      const executable = join(directory, "codex");
      await writeFile(executable, "#!/bin/sh\nprintf 'codex 1.2.3\\n'\n", {
        mode: 0o700,
      });
      await chmod(executable, 0o700);
      const database = openDatabase(":memory:");
      const service = new RuntimeService(new Repositories(database));
      const result = await service.setExecutable("codex", executable);
      expect(result.available).toBe(true);
      expect(result.version).toBe("codex 1.2.3");
      expect(result.capabilities).toEqual(["discovery", "version-probe"]);
      database.close();
    }
  );

  it("rejects a directory as an executable", async () => {
    const directory = await mkdtemp(join(tmpdir(), "contentdesk-runtime-"));
    const database = openDatabase(":memory:");
    const service = new RuntimeService(new Repositories(database));
    await expect(service.setExecutable("codex", directory)).rejects.toThrow(
      "regular file"
    );
    database.close();
  });
});
