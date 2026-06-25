-- Remove legacy D1 tables not used by V1 Worker code.
-- Anonymous relay does not store peer graphs or message bodies in D1.

DROP INDEX IF EXISTS idx_conversations_user_a;
DROP INDEX IF EXISTS idx_conversations_user_b;
DROP TABLE IF EXISTS conversations;

DROP TABLE IF EXISTS consents;
