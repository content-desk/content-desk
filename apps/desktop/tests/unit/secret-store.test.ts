import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type SecretCrypto,
  SecretStore,
} from "../../src/main/secrets/secret-store";

class TestCrypto implements SecretCrypto {
  public async available() {
    return true;
  }
  public async encrypt(value: string) {
    return Buffer.from(Buffer.from(value).toString("base64"), "utf8");
  }
  public async decrypt(value: Buffer) {
    return {
      plaintext: Buffer.from(value.toString("utf8"), "base64").toString("utf8"),
      shouldReEncrypt: false,
    };
  }
}

describe("SecretStore", () => {
  it("keeps sensitive values out of plaintext files and restricts permissions", async () => {
    const root = await mkdtemp(join(tmpdir(), "contentdesk-secret-"));
    const store = new SecretStore(root, new TestCrypto());
    await store.write("provider-1", {
      apiKey: "top-secret",
      headers: { Authorization: "Bearer private" },
    });
    const file = join(root, "secrets", "provider-1.bin");
    expect((await readFile(file, "utf8")).includes("top-secret")).toBe(false);
    expect((await stat(file)).mode.toString(8).slice(-3)).toBe("600");
    expect(await store.read("provider-1")).toEqual({
      apiKey: "top-secret",
      headers: { Authorization: "Bearer private" },
    });
  });

  it("fails closed when platform encryption is unavailable", async () => {
    const crypto: SecretCrypto = {
      available: async () => false,
      decrypt: async () => ({ plaintext: "", shouldReEncrypt: false }),
      encrypt: async () => Buffer.alloc(0),
    };
    const store = new SecretStore(tmpdir(), crypto);
    await expect(store.write("provider-2", { headers: {} })).rejects.toThrow(
      "unavailable"
    );
  });
});
