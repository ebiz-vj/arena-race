/**
 * DB layer: init schema, matches, match_turns.
 */
import { getDb, initSchema, ensureDataDir, DEFAULT_DB_PATH } from "./schema";
import * as matches from "./matches";
import * as turns from "./turns";

let dbInstance: ReturnType<typeof getDb> | null = null;

export function initDb(dbPath: string = DEFAULT_DB_PATH): ReturnType<typeof getDb> {
  ensureDataDir(dbPath);
  const db = getDb(dbPath);
  initSchema(db);
  dbInstance = db;
  return db;
}

export function getDbInstance(): ReturnType<typeof getDb> | null {
  return dbInstance;
}

export { matches, turns, initSchema, getDb, DEFAULT_DB_PATH };
