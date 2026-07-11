-- Read-only D1 privacy audit for Nekonymous V2.
-- Run via: ./tools/audit-d1.sh [--local|--remote]

-- Allowed tables only
SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users;
SELECT 'public_links' AS table_name, COUNT(*) AS row_count FROM public_links;
SELECT 'platform_daily_stats' AS table_name, COUNT(*) AS row_count FROM platform_daily_stats;
SELECT 'platform_daily_stats_by_key' AS table_name, COUNT(*) AS row_count FROM platform_daily_stats_by_key;
SELECT 'platform_daily_unique_stats' AS table_name, COUNT(*) AS row_count FROM platform_daily_unique_stats;

-- Users: no raw Telegram ids; chat ids encrypted
SELECT
  id,
  LENGTH(telegram_user_hash) AS hash_len,
  CASE
    WHEN telegram_user_hash != '' AND telegram_user_hash NOT GLOB '*[^0-9]*' THEN 'FAIL_numeric_hash'
    ELSE 'ok'
  END AS hash_check,
  CASE
    WHEN telegram_chat_ciphertext LIKE '{%' THEN 'ok_encrypted'
    ELSE 'FAIL_plain_chat'
  END AS chat_check,
  locale,
  status
FROM users
ORDER BY created_at
LIMIT 20;

-- Anonymous daily aggregate stats (no user ids)
SELECT event_name, SUM(count) AS total
FROM platform_daily_stats
GROUP BY event_name
ORDER BY event_name;
