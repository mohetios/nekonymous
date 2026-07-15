-- Full D1 wipe before reapplying migrations/0001_init.sql.

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS platform_stats_event_receipts;
DROP TABLE IF EXISTS platform_daily_unique_stats;
DROP TABLE IF EXISTS platform_daily_stats_by_key;
DROP TABLE IF EXISTS platform_daily_stats;
DROP TABLE IF EXISTS public_links;
DROP TABLE IF EXISTS users;

DROP TABLE IF EXISTS d1_migrations;

PRAGMA foreign_keys = ON;
