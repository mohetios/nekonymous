-- Read-only D1 privacy / soul audit for Nekonymous V1.
-- Run via: ./tools/audit-d1.sh [--local|--remote]
--
-- Each section is also executed individually by the shell script for readable output.

-- 1) Table row counts
SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users;
SELECT 'public_links' AS table_name, COUNT(*) AS row_count FROM public_links;
SELECT 'reports' AS table_name, COUNT(*) AS row_count FROM reports;
SELECT 'assessment_profiles' AS table_name, COUNT(*) AS row_count FROM assessment_profiles;
SELECT 'assessment_attempts' AS table_name, COUNT(*) AS row_count FROM assessment_attempts;
SELECT 'assessment_answers' AS table_name, COUNT(*) AS row_count FROM assessment_answers;
SELECT 'profile_vector_index_events' AS table_name, COUNT(*) AS row_count FROM profile_vector_index_events;
SELECT 'match_requests' AS table_name, COUNT(*) AS row_count FROM match_requests;
SELECT 'match_suggestions' AS table_name, COUNT(*) AS row_count FROM match_suggestions;
SELECT 'match_blocks' AS table_name, COUNT(*) AS row_count FROM match_blocks;
SELECT 'match_events' AS table_name, COUNT(*) AS row_count FROM match_events;
SELECT 'platform_stats' AS table_name, COUNT(*) AS row_count FROM platform_stats;

-- 2) Users: no raw Telegram ids; chat ids encrypted
SELECT
  id,
  LENGTH(telegram_user_hash) AS hash_len,
  CASE
    WHEN telegram_user_hash GLOB '[0-9]*' THEN 'FAIL_numeric_hash'
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

-- 3) Match intros must be ciphertext envelopes
SELECT
  id,
  status,
  CASE
    WHEN intro_ciphertext LIKE '{%' THEN 'ok_encrypted'
    ELSE 'FAIL_plain_intro'
  END AS intro_check,
  requester_user_id,
  candidate_user_id
FROM match_requests
ORDER BY created_at DESC
LIMIT 20;

-- 4) Reports: optional details must not be plaintext
SELECT
  id,
  reason_code,
  CASE
    WHEN details_ciphertext IS NULL THEN 'none'
    WHEN details_ciphertext LIKE '{%' THEN 'ok_encrypted'
    ELSE 'FAIL_plain_details'
  END AS details_check,
  reporter_user_id,
  reported_user_id
FROM reports
ORDER BY created_at DESC
LIMIT 20;

-- 5) Assessment answers should be Likert integers only
SELECT
  question_id,
  answer_value,
  CASE
    WHEN answer_value BETWEEN 1 AND 5 THEN 'ok'
    ELSE 'FAIL_invalid_likert'
  END AS answer_check
FROM assessment_answers
ORDER BY answered_at DESC
LIMIT 10;

-- 6) Profile summaries are controlled text, not inbox payloads
SELECT
  user_id,
  discoverable,
  vector_status,
  LENGTH(dimension_scores_json) AS scores_len,
  LENGTH(profile_summary_text) AS summary_len,
  substr(profile_summary_text, 1, 80) AS summary_preview
FROM assessment_profiles
ORDER BY updated_at DESC
LIMIT 10;

-- 7) Anonymous platform stats (no user ids)
SELECT * FROM platform_stats WHERE id = 1;

-- 8) Match events should not carry message bodies in metadata
SELECT
  type,
  user_id,
  target_user_id,
  substr(metadata_json, 1, 160) AS metadata_preview
FROM match_events
ORDER BY created_at DESC
LIMIT 20;
