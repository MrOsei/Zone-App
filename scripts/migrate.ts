import { getDb, databasePath } from "../src/lib/server/db";

const db = getDb();
const migrations = db.prepare("SELECT version,applied_at FROM schema_migrations ORDER BY version").all();
console.log(`SQLite ready at ${databasePath}`);
console.table(migrations);
db.close();
