-- Adds the profile-basics columns introduced in the post-signup profile step.
-- Apply once against existing D1 deployments. New deployments get them via schema.sql.
-- Each ALTER is idempotent-safe only on a fresh DB; if a column already exists, skip that line.

ALTER TABLE profiles ADD COLUMN school TEXT;
ALTER TABLE profiles ADD COLUMN grade_level TEXT;
ALTER TABLE profiles ADD COLUMN gender TEXT;
ALTER TABLE profiles ADD COLUMN birthdate TEXT;
ALTER TABLE profiles ADD COLUMN contact_number TEXT;
ALTER TABLE profiles ADD COLUMN guardian_name TEXT;
ALTER TABLE profiles ADD COLUMN basics_completed INTEGER NOT NULL DEFAULT 0;
