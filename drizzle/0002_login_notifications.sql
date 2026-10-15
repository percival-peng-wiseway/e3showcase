ALTER TABLE visits ADD COLUMN notification_status TEXT NOT NULL DEFAULT 'not_requested';
ALTER TABLE visits ADD COLUMN notification_email_id TEXT NOT NULL DEFAULT '';
ALTER TABLE visits ADD COLUMN notification_error TEXT NOT NULL DEFAULT '';
