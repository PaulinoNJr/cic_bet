const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const globalForDatabase = globalThis;
const BOOLEAN_COLUMNS = new Set(["is_admin", "is_correct"]);

function getDatabasePath() {
  const configuredPath = String(process.env.SQLITE_PATH || "").trim();

  if (!configuredPath) {
    if (process.platform === "win32") {
      return path.join(process.env.TEMP || "C:\\tmp", "cic-bet", "cic-bet.sqlite");
    }

    return path.join(process.cwd(), "data", "cic-bet.sqlite");
  }

  if (path.isAbsolute(configuredPath)) {
    return configuredPath;
  }

  return path.resolve(process.cwd(), configuredPath);
}

function getDatabase() {
  if (!globalForDatabase.__cicBetDatabase) {
    globalForDatabase.__cicBetDatabase = createDatabase();
  }

  return globalForDatabase.__cicBetDatabase;
}

function createDatabase() {
  const databasePath = getDatabasePath();
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const database = new DatabaseSync(databasePath);
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA busy_timeout = 5000;");

  const schemaPath = path.join(__dirname, "..", "..", "sqlite", "schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  database.exec(schemaSql);
  runMigrations(database);

  return database;
}

function runMigrations(database) {
  ensureColumn(database, "users", "password_hash", "TEXT");
  ensureColumn(database, "predictions", "is_correct", "INTEGER CHECK (is_correct IN (0, 1) OR is_correct IS NULL)");
  ensureColumn(
    database,
    "predictions",
    "predicted_value",
    "TEXT NOT NULL DEFAULT 'Sem palpite informado'"
  );

  database
    .prepare(
      `
        UPDATE predictions
        SET predicted_value = 'Sem palpite informado'
        WHERE predicted_value IS NULL OR trim(predicted_value) = ''
      `
    )
    .run();
}

function ensureColumn(database, tableName, columnName, definition) {
  assertIdentifier(tableName);
  assertIdentifier(columnName);

  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all();
  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

function assertIdentifier(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Identificador SQL invalido: ${value}`);
  }
}

function createClient(database) {
  return {
    async query(sql, params = []) {
      const statement = database.prepare(sql);
      const normalizedSql = String(sql).trim().toLowerCase();

      if (normalizedSql.startsWith("select") || normalizedSql.startsWith("pragma") || normalizedSql.startsWith("with")) {
        return {
          rows: normalizeRows(statement.all(...params))
        };
      }

      const result = statement.run(...params);
      return {
        rows: [],
        rowCount: Number(result.changes || 0),
        lastInsertRowid: result.lastInsertRowid
      };
    }
  };
}

function normalizeRows(rows) {
  return rows.map((row) => {
    const normalized = { ...row };

    for (const [key, value] of Object.entries(normalized)) {
      if (BOOLEAN_COLUMNS.has(key) && (value === 0 || value === 1)) {
        normalized[key] = Boolean(value);
      }
    }

    return normalized;
  });
}

async function query(sql, params = []) {
  return createClient(getDatabase()).query(sql, params);
}

async function withTransaction(callback) {
  const database = getDatabase();
  const client = createClient(database);

  database.exec("BEGIN IMMEDIATE");

  try {
    const result = await callback(client);
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

module.exports = {
  getDatabase,
  getDatabasePath,
  query,
  withTransaction
};
