import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

export function database(path) {
  const sqlite = new DatabaseSync(path);
  sqlite.exec('PRAGMA journal_mode=WAL');
  sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
  const migrationDir = new URL('../drizzle/', import.meta.url);
  for (const name of readdirSync(migrationDir).filter(x => x.endsWith('.sql')).sort()) {
    if (sqlite.prepare('SELECT name FROM local_migrations WHERE name=?').get(name)) continue;
    // Adopt databases created by the original standalone server.
    if (name === '0000_access_log.sql' && sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='visits'").get()) {
      sqlite.prepare('INSERT INTO local_migrations (name) VALUES (?)').run(name);
      continue;
    }
    sqlite.exec('BEGIN');
    try {
      sqlite.exec(readFileSync(new URL(name, migrationDir), 'utf8'));
      sqlite.prepare('INSERT INTO local_migrations (name) VALUES (?)').run(name);
      sqlite.exec('COMMIT');
    } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  }
  const db = {
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() { return sqlite.prepare(sql).get(...args) || null; },
        async all() { return { results: sqlite.prepare(sql).all(...args) }; },
        async run() { return sqlite.prepare(sql).run(...args); },
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const result = [];
        for (const statement of statements) result.push(await statement.run());
        sqlite.exec('COMMIT');
        return result;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  return { db, sqlite };
}
