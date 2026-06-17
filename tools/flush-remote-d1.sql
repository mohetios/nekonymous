-- Full D1 wipe: drop all app tables and migration history.
-- Use before re-applying migrations/0001_init.sql on a fresh or squashed migration set.

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS match_events;
DROP TABLE IF EXISTS match_suggestions;
DROP TABLE IF EXISTS match_blocks;
DROP TABLE IF EXISTS match_requests;
DROP TABLE IF EXISTS profile_vector_index_events;
DROP TABLE IF EXISTS assessment_answers;
DROP TABLE IF EXISTS assessment_attempts;
DROP TABLE IF EXISTS assessment_profiles;
DROP TABLE IF EXISTS test_answers;
DROP TABLE IF EXISTS test_attempts;
DROP TABLE IF EXISTS test_profiles;
DROP TABLE IF EXISTS consents;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS public_links;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS d1_migrations;

PRAGMA foreign_keys = ON;
