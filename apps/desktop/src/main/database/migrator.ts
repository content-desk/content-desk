import type { DatabaseSync } from "node:sqlite";
import {
  bundledMigrations,
  type Migration,
} from "@desktop/main/database/migration-loader";

interface MigrationRow {
  checksum: string;
  name: string;
  version: number;
}

export function migrateDatabase(
  database: DatabaseSync,
  migrations: readonly Migration[] = bundledMigrations
): void {
  const currentVersion = getUserVersion(database);
  const latestVersion = migrations.at(-1)?.version ?? 0;
  if (currentVersion > latestVersion) {
    throw new Error(
      `Database version ${currentVersion} is newer than this app supports (${latestVersion}).`
    );
  }

  const hasHistory = Boolean(
    database
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_migrations'"
      )
      .get()
  );
  if (currentVersion > 0 && !hasHistory) {
    throw new Error(
      "This database predates the versioned migration system. Back it up, then rebuild the Desktop database before restarting."
    );
  }

  if (hasHistory) {
    verifyHistory(database, migrations, currentVersion);
  }

  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue;
    }
    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(migration.sql);
      database
        .prepare(
          "INSERT INTO _migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)"
        )
        .run(
          migration.version,
          migration.name,
          migration.checksum,
          new Date().toISOString()
        );
      database.exec(`PRAGMA user_version = ${migration.version}`);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw new Error(
        `Database migration ${migration.version.toString().padStart(4, "0")}_${migration.name} failed.`,
        { cause: error }
      );
    }
  }
}

function getUserVersion(database: DatabaseSync): number {
  return (
    database.prepare("PRAGMA user_version").get() as { user_version: number }
  ).user_version;
}

function verifyHistory(
  database: DatabaseSync,
  migrations: readonly Migration[],
  currentVersion: number
): void {
  const rows = database
    .prepare("SELECT version, name, checksum FROM _migrations ORDER BY version")
    .all() as unknown as MigrationRow[];
  if (rows.length !== currentVersion) {
    throw new Error(
      `Migration history has ${rows.length} entries but user_version is ${currentVersion}.`
    );
  }
  for (let index = 0; index < currentVersion; index += 1) {
    const expected = migrations[index];
    const actual = rows[index];
    if (
      !(expected && actual) ||
      actual.version !== expected.version ||
      actual.name !== expected.name ||
      actual.checksum !== expected.checksum
    ) {
      throw new Error(
        `Migration history mismatch at version ${index + 1}; released migrations must not be modified.`
      );
    }
  }
}
