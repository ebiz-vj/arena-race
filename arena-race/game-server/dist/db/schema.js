"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_DB_PATH = void 0;
exports.getDb = getDb;
exports.initSchema = initSchema;
exports.ensureDataDir = ensureDataDir;
/**
 * SQLite schema for matches and match_turns. TDD §11.2, §11.3.
 * Migrations/init: create tables on first run.
 */
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
exports.DEFAULT_DB_PATH = path_1.default.join(process.cwd(), "data", "arena.db");
function getDb(dbPath = exports.DEFAULT_DB_PATH) {
    return new better_sqlite3_1.default(dbPath);
}
function initSchema(db) {
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
function ensureDataDir(dbPath) {
    const dir = path_1.default.dirname(dbPath);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
}
