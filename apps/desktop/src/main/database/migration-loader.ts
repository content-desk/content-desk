import { createHash } from "node:crypto";

export interface Migration {
  checksum: string;
  name: string;
  sql: string;
  version: number;
}

const migrationFilename = /^(\d{4})_([a-z][a-z0-9]*(?:_[a-z0-9]+)*)\.sql$/;
const byteOrderMark = /^\uFEFF/;
const carriageReturn = /\r\n?/g;

const rawMigrations = import.meta.glob("./migrations/*.sql", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

export function loadMigrations(modules: Record<string, string>): Migration[] {
  const migrations = Object.entries(modules).map(([path, rawSql]) => {
    const filename = path.slice(path.lastIndexOf("/") + 1);
    const match = migrationFilename.exec(filename);
    if (!match) {
      throw new Error(
        `Invalid migration filename "${filename}". Expected NNNN_snake_case.sql.`
      );
    }
    const [, versionText, name] = match;
    if (!(versionText && name)) {
      throw new Error(`Could not parse migration filename "${filename}".`);
    }
    const sql = rawSql.replace(byteOrderMark, "").replace(carriageReturn, "\n");
    if (!sql.trim()) {
      throw new Error(`Migration "${filename}" is empty.`);
    }
    return {
      checksum: createHash("sha256").update(sql).digest("hex"),
      name,
      sql,
      version: Number.parseInt(versionText, 10),
    };
  });

  migrations.sort((left, right) => left.version - right.version);
  if (migrations.length === 0) {
    throw new Error("No bundled database migrations were found.");
  }
  for (const [index, migration] of migrations.entries()) {
    const expectedVersion = index + 1;
    if (migration.version !== expectedVersion) {
      const reason =
        migration.version < expectedVersion ? "duplicate" : "missing";
      throw new Error(
        `Migration version ${expectedVersion} is ${reason}; versions must be continuous from 0001.`
      );
    }
  }
  return migrations;
}

export const bundledMigrations = loadMigrations(rawMigrations);
