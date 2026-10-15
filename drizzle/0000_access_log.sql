CREATE TABLE visits (id TEXT PRIMARY KEY NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL, organization TEXT NOT NULL, role TEXT NOT NULL, started_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, active_seconds INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE events (id TEXT PRIMARY KEY NOT NULL, visit_id TEXT NOT NULL, chapter TEXT NOT NULL, event TEXT NOT NULL, created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX events_visit_idx ON events(visit_id);
--> statement-breakpoint
CREATE TABLE attempts (key TEXT NOT NULL, created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX attempts_key_time_idx ON attempts(key, created_at);

--> statement-breakpoint
CREATE UNIQUE INDEX events_visit_chapter_idx ON events(visit_id,chapter);
