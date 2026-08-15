import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, realpath, stat } from "node:fs/promises";
import { delimiter, isAbsolute, join } from "node:path";
import type { Repositories } from "@desktop/main/database/repositories";
import type { RuntimeKind, RuntimeProfile } from "@desktop/shared/contracts";

const executableNames: Record<
  Exclude<RuntimeKind, "contentdesk-native">,
  string[]
> = {
  "claude-code":
    process.platform === "win32" ? ["claude.exe", "claude.cmd"] : ["claude"],
  codex: process.platform === "win32" ? ["codex.exe", "codex.cmd"] : ["codex"],
};

export class RuntimeService {
  public constructor(private readonly repositories: Repositories) {}

  public list(): RuntimeProfile[] {
    return this.repositories.listRuntimes();
  }

  public async setExecutable(
    kind: Exclude<RuntimeKind, "contentdesk-native">,
    path: string
  ): Promise<RuntimeProfile> {
    await validateExecutable(path);
    this.repositories.updateRuntime(kind, {
      executablePath: await realpath(path),
    });
    return this.probe(kind);
  }

  public async probe(kind: RuntimeKind): Promise<RuntimeProfile> {
    if (kind === "contentdesk-native") {
      return this.repositories.getRuntime(kind);
    }
    const current = this.repositories.getRuntime(kind);
    const executable = current.executablePath ?? (await discover(kind));
    const now = new Date().toISOString();
    if (!executable) {
      return this.repositories.updateRuntime(kind, {
        available: false,
        lastError: "Executable not found on PATH.",
        lastProbedAt: now,
        version: null,
      });
    }
    try {
      await validateExecutable(executable);
      const version = await runVersion(executable);
      return this.repositories.updateRuntime(kind, {
        available: true,
        executablePath: await realpath(executable),
        lastError: null,
        lastProbedAt: now,
        version,
      });
    } catch (error) {
      return this.repositories.updateRuntime(kind, {
        available: false,
        executablePath: executable,
        lastError: error instanceof Error ? error.message : "Probe failed.",
        lastProbedAt: now,
        version: null,
      });
    }
  }
}

async function discover(
  kind: Exclude<RuntimeKind, "contentdesk-native">
): Promise<string | null> {
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (!(directory && isAbsolute(directory))) {
      continue;
    }
    for (const name of executableNames[kind]) {
      const candidate = join(directory, name);
      try {
        await validateExecutable(candidate);
        return await realpath(candidate);
      } catch {
        // Continue through PATH without invoking a shell.
      }
    }
  }
  return null;
}

async function validateExecutable(path: string): Promise<void> {
  if (!isAbsolute(path)) {
    throw new Error("Executable path must be absolute.");
  }
  const resolved = await realpath(path);
  const details = await stat(resolved);
  if (!details.isFile()) {
    throw new Error("Executable path must be a regular file.");
  }
  await access(resolved, constants.X_OK);
}

function runVersion(executable: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ["--version"], {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    let size = 0;
    const append = (chunk: Buffer) => {
      size += chunk.length;
      if (size > 16_384) {
        child.kill("SIGKILL");
      } else {
        chunks.push(chunk);
      }
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      const output = Buffer.concat(chunks).toString("utf8").trim();
      if (size > 16_384) {
        reject(new Error("Probe output exceeded 16 KiB."));
      } else if (code === 0) {
        resolve(output.slice(0, 500));
      } else {
        reject(new Error(`Version probe exited with code ${code}.`));
      }
    });
  });
}
