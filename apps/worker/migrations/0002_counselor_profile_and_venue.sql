-- Adds counselor-specific profile columns, seminar venue, and seminar invite joined/declined
-- bookkeeping. Safe to apply once against existing D1 deployments.

ALTER TABLE profiles ADD COLUMN first_name TEXT;
ALTER TABLE profiles ADD COLUMN last_name TEXT;

ALTER TABLE seminars ADD COLUMN venue TEXT;
