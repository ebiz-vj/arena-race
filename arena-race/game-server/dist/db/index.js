"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_DB_PATH = exports.getDb = exports.initSchema = exports.turns = exports.matches = void 0;
exports.initDb = initDb;
exports.getDbInstance = getDbInstance;
/**
 * DB layer: init schema, matches, match_turns.
 */
const schema_1 = require("./schema");
Object.defineProperty(exports, "getDb", { enumerable: true, get: function () { return schema_1.getDb; } });
Object.defineProperty(exports, "initSchema", { enumerable: true, get: function () { return schema_1.initSchema; } });
Object.defineProperty(exports, "DEFAULT_DB_PATH", { enumerable: true, get: function () { return schema_1.DEFAULT_DB_PATH; } });
const matches = __importStar(require("./matches"));
exports.matches = matches;
const turns = __importStar(require("./turns"));
exports.turns = turns;
let dbInstance = null;
function initDb(dbPath = schema_1.DEFAULT_DB_PATH) {
    (0, schema_1.ensureDataDir)(dbPath);
    const db = (0, schema_1.getDb)(dbPath);
    (0, schema_1.initSchema)(db);
    dbInstance = db;
    return db;
}
function getDbInstance() {
    return dbInstance;
}
