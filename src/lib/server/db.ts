import Database from "better-sqlite3";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const globalForDb = globalThis as unknown as { zoneDb?: Database.Database };
export const dataDir = process.env.DATA_DIR || path.join(process.cwd(), ".data");
export const databasePath = process.env.DATABASE_PATH || path.join(dataDir, "zone.sqlite");

export function migrate(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
  const directory = path.join(process.cwd(), "db", "migrations");
  const applied = new Set(db.prepare("SELECT version FROM schema_migrations").all().map((row) => (row as { version: string }).version));
  const apply = db.transaction((version: string, sql: string) => {
    db.exec(sql);
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(version, new Date().toISOString());
  });
  for (const filename of readdirSync(directory).filter((name) => name.endsWith(".sql")).sort()) {
    if (!applied.has(filename)) apply(filename, readFileSync(path.join(directory, filename), "utf8"));
  }
}

export function getDb() {
  if (!globalForDb.zoneDb) {
    mkdirSync(path.dirname(databasePath), { recursive: true });
    const db = new Database(databasePath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000");
    db.pragma("synchronous = NORMAL");
    migrate(db);
    globalForDb.zoneDb = db;
  }
  return globalForDb.zoneDb;
}

export function closeDb() {
  if (globalForDb.zoneDb) {
    globalForDb.zoneDb.close();
    globalForDb.zoneDb = undefined;
  }
}

export const now = () => new Date().toISOString();
export const id = () => crypto.randomUUID();

export function addNotification(userId: string, actorId: string | null, type: string, entityId: string | null, body: string) {
  if (userId === actorId) return;
  getDb().prepare("INSERT INTO notifications (id,user_id,actor_id,type,entity_id,body,created_at) VALUES (?,?,?,?,?,?,?)")
    .run(id(), userId, actorId, type, entityId, body, now());
}

export function isBlocked(a: string, b: string) {
  return Boolean(getDb().prepare("SELECT 1 FROM blocks WHERE (blocker_id=? AND blocked_id=?) OR (blocker_id=? AND blocked_id=?)").get(a, b, b, a));
}

export function areConnected(a: string, b: string) {
  return Boolean(getDb().prepare("SELECT 1 FROM connections WHERE status='accepted' AND ((sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?))").get(a, b, b, a));
}
