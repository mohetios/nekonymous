-- Partial wipe: assessment + match tables only.
-- Full reset: ./tools/flush-remote.sh

DELETE FROM match_events;
DELETE FROM match_requests;
DELETE FROM match_suggestions;
DELETE FROM match_blocks;
DELETE FROM profile_vector_index_events;
DELETE FROM assessment_answers;
DELETE FROM assessment_attempts;
DELETE FROM assessment_profiles;
