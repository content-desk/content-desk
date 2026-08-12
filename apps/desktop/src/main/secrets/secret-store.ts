import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import type { safeStorage as ElectronSafeStorage } from "electron";

export interface ProviderSecrets {
  apiKey?: string;
  headers: Record<string, string>;
}

export interface SecretCrypto {
  available: () => Promise<boolean>;
  decrypt: (
    value: Buffer
  ) => Promise<{ plaintext: string; shouldReEncrypt: boolean }>;
  encrypt: (value: string) => Promise<Buffer>;
}

export interface SecretRepository {
  delete: (reference: string | null) => Promise<void>;
  read: (reference: string) => Promise<ProviderSecrets>;
  write: (reference: string, secrets: ProviderSecrets) => Promise<void>;
}

export class ElectronSecretCrypto implements SecretCrypto {
  public constructor(private readonly crypto: typeof ElectronSafeStorage) {}

  public async available(): Promise<boolean> {
    if (!(await this.crypto.isAsyncEncryptionAvailable())) {
      return false;
    }
    if (process.platform !== "linux") {
      return true;
    }
    const backend = this.crypto.getSelectedStorageBackend();
    return backend !== "basic_text" && backend !== "unknown";
  }

  public async encrypt(value: string): Promise<Buffer> {
    return this.crypto.encryptStringAsync(value);
  }

  public async decrypt(
    value: Buffer
  ): Promise<{ plaintext: string; shouldReEncrypt: boolean }> {
    const result = await this.crypto.decryptStringAsync(value);
    return {
      plaintext: result.result,
      shouldReEncrypt: result.shouldReEncrypt,
    };
  }
}

export class SecretStore implements SecretRepository {
  private readonly directory: string;

  public constructor(
    root: string,
    private readonly crypto: SecretCrypto
  ) {
    this.directory = join(root, "secrets");
  }

  public async write(
    reference: string,
    secrets: ProviderSecrets
  ): Promise<void> {
    await this.requireEncryption();
    await mkdir(this.directory, { mode: 0o700, recursive: true });
    const encrypted = await this.crypto.encrypt(JSON.stringify(secrets));
    const target = this.path(reference);
    const temporary = `${target}.${randomUUID()}.tmp`;
    const handle = await open(temporary, "wx", 0o600);
    try {
      await handle.writeFile(encrypted);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, target);
  }

  public async read(reference: string): Promise<ProviderSecrets> {
    await this.requireEncryption();
    const encrypted = await readFile(this.path(reference));
    const result = await this.crypto.decrypt(encrypted);
    const secrets = JSON.parse(result.plaintext) as ProviderSecrets;
    if (result.shouldReEncrypt) {
      await this.write(reference, secrets);
    }
    return secrets;
  }

  public async delete(reference: string | null): Promise<void> {
    if (reference) {
      await rm(this.path(reference), { force: true });
    }
  }

  private path(reference: string): string {
    const safeReference = reference.replace(/[^a-zA-Z0-9-]/g, "");
    if (!safeReference || safeReference !== reference) {
      throw new Error("Invalid secret reference.");
    }
    return join(this.directory, `${safeReference}.bin`);
  }

  private async requireEncryption(): Promise<void> {
    if (!(await this.crypto.available())) {
      throw new Error("Secure credential storage is temporarily unavailable.");
    }
  }
}
