# Release Hardening Sign-off

**Date:** 2026-07-12  
**Branch:** `fix/release-hardening-2026-07`  
**Base HEAD:** `f94cdb2`

## Scope

- Sealed ticket expiry, alarm cleanup, and inbox pointer eviction cleanup.
- Hard reset best-effort cleanup for inbox tickets, profile vault state, and Vectorize IDs available through encrypted profile routes.
- Conversation request idempotency for accepted intro tickets and request notifications.
- Telegram outbox leases, permanent failure handling, retention cleanup, and per-chat ordered dispatch.
- Runtime safety for unknown queues, webhook idempotency sharding, sanitized logs, decrypted capsule validation, and blinded report evidence.
- Automatic check workflow on pull requests and `master` pushes.

## Verification

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:ticketing`
- `pnpm test:idempotency`
- `pnpm test:conversation-requests`
- `pnpm test:release-hardening`
- `pnpm check`
- `git diff --check`

## Notes

- No deploy, remote migration, KV clear, Vectorize reset, or BotFather mutation was run.
- Existing profile records created before this hardening may not have Vectorize IDs in their encrypted profile route; reset cleanup is best-effort for those records and complete for records indexed after this change.
