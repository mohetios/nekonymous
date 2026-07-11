-- Full D1 wipe before reapplying migrations/0001_init.sql (V2 identity + stats only).
-- Safe to run on remote or local; drops migration history so the squashed init re-applies.

PRAGMA foreign_keys = OFF;

-- V2 allowed tables
DROP TABLE IF EXISTS platform_daily_unique_stats;
DROP TABLE IF EXISTS platform_daily_stats_by_key;
DROP TABLE IF EXISTS platform_daily_stats;
DROP TABLE IF EXISTS public_links;
DROP TABLE IF EXISTS users;

-- Legacy V1 tables (no-op if absent)
DROP TABLE IF EXISTS platform_stats;
DROP TABLE IF EXISTS match_events;
DROP TABLE IF EXISTS match_suggestions;
DROP TABLE IF EXISTS match_blocks;
DROP TABLE IF EXISTS match_requests;
DROP TABLE IF EXISTS profile_vector_index_events;
DROP TABLE IF EXISTS assessment_answers;
DROP TABLE IF EXISTS assessment_attempts;
DROP TABLE IF EXISTS assessment_profiles;
DROP TABLE IF EXISTS reports;

DROP TABLE IF EXISTS d1_migrations;

PRAGMA foreign_keys = ON;
