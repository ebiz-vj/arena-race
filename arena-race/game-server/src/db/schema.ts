/**
 * SQLite schema for matches and match_turns. TDD §11.2, §11.3.
 * Migrations/init: create tables on first run.
 */
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

export const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "arena.db");

export function getDb(dbPath: string = DEFAULT_DB_PATH): Database.Database {
  return new Database(dbPath);
}

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id TEXT UNIQUE NOT NULL,
      tier TEXT NOT NULL,
      status TEXT NOT NULL,
      entry_deadline INTEGER NOT NULL,
      started_at INTEGER,
      ended_at INTEGER,
      final_placement TEXT,
      result_signature TEXT,
      contract_tx_hash TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_matches_match_id ON matches(match_id);
    CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);

    CREATE TABLE IF NOT EXISTS match_turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id TEXT NOT NULL,
      turn_index INTEGER NOT NULL,
      state_before TEXT NOT NULL,
      actions TEXT NOT NULL,
      state_after TEXT NOT NULL,
      scores_after TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_match_turns_match_id_turn ON match_turns(match_id, turn_index);
  `);
}

export function ensureDataDir(dbPath: string): void {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
