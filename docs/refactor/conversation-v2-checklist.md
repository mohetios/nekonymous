# Conversation Suggestions V2 — Phase Checklist

Track refactor progress phase by phase. **Do not start the next phase while the current gate fails.**

| Phase | Title | Status | Gate |
|-------|-------|--------|------|
| 0 | Repository audit and baseline (removed after V2 sign-off; see git history) | ✅ Done | Audit doc + baseline commands recorded |
| 1 | Canonical V2 contracts | ✅ Done | `conversation-suggestions-v2.md` + threat model + AGENTS.md |
| 2 | Remove V1 persistence and contracts | ✅ Done | No V1 table/symbol hits in source (except obsolete docs) |
| 3 | Cloudflare resource foundation | ✅ Done | `pnpm typecheck`; new DOs + bindings verified |
| 4 | Capability and crypto foundation | ✅ Done | Capability tests + storage-leak verifier |
| 5 | Conversation Profile engine | ✅ Done | Profile builder/session tests |
| 6 | Profile indexing pipeline | ✅ Done | Idempotent queue + dual-vector tests |
| 7 | Dual-channel candidate retrieval | ✅ Done | Bounded retrieval under load |
| 8 | Reciprocal deterministic ranker | ✅ Done | Golden + property tests |
| 9 | Eligibility, moderation and exposure | ✅ Done | Hard filters override rank |
| 10 | Suggestion capabilities | ✅ Done | Expired/replay/mismatch fail safe |
| 11 | Request capabilities and pair locking | ✅ Done | Concurrency race tests |
| 12 | Bot UX and i18n replacement | ✅ Done | Full FA flow wired |
| 13 | Statistics and learning readiness | ✅ Done | Aggregate stats events emitted |
| 14 | Test and audit suite | ✅ Done | `pnpm check` green |
| 15 | Final removal and documentation sync | ✅ Done | V1 dirs removed, docs updated |
| 16 | Release verification (manual + privacy) | ✅ Done | Remote D1 audit OK; two-account E2E user-verified; tag `pre-release-conversation-v2-acca6b9` |

## Phase 16 — release gates (pre sign-off)

Static `pnpm check` is necessary but **not sufficient**. All must pass before production sign-off:

### Source control

- [x] Commit on `master`
- [x] Tag + push `pre-release-conversation-v2-*` to remote (`pre-release-conversation-v2-acca6b9`)

### Two-account Telegram E2E (mandatory)

User-verified on remote (2026-07-11): assessment, profile view, discoverability, search, messaging, and settings flows behaved normally.

```text
/start A + B → /assessment both → raw answers cleared → vectors verified
→ discoverability on both → A searches → intro → B request notify
→ B accepts → intro via sealed inbox → reply → block/report
→ hard reset removes profile + vectors
```

Also: decline, cancel, duplicate send, double accept, disable discoverability, retake profile, stale index job, expired request.

### Queue idempotency (at-least-once)

- [x] Automated policy: `pnpm test:profile-index-idempotency` (in `pnpm check`)

### Privacy audit (all storage planes)

- [x] Remote `pnpm audit:d1` — OK (V2 schema; 2 users; 0 privacy failures; no forbidden tables)
- [ ] Manual DO/queue/Vectorize/log spot-check (optional post-release monitoring)

### DO migration freeze

After pre-release sign-off, avoid new delete migrations. Recovery = current commit + wrangler config + fresh resources + redeploy (rollback does not restore DO storage).

## Phase artifacts

| Phase | Primary deliverables |
|-------|---------------------|
| 0 | Phase 0 baseline recorded in git history | |
| 1 | `docs/architecture/conversation-suggestions-v2.md`, `threat-model.md`, `AGENTS.md` |
| 2 | `migrations/0001_init.sql` rewrite; delete V1 feature dirs |
| 3 | New DO classes, wrangler bindings, `tools/setup-conversation-v2-resources.sh` |
| 4 | Capability resolvers, `tools/verify-conversation-storage-leak.ts` |
| 5 | `src/features/conversation-profile/**` |
| 6 | Profile index queue consumer, Vectorize namespaces |
| 7 | `src/features/conversation-suggestions/candidate-*.ts` |
| 8 | `src/features/conversation-ranking/**` |
| 9 | Exposure reranker + pair ledger integration |
| 10 | `ConversationVaultShardDO` suggestion tickets |
| 11 | Request tickets + `PairLedgerShardDO` |
| 12 | Bot handlers, i18n, commands |
| 13 | Stats events + future-learning contract (disabled) |
| 14 | `tools/verify-conversation-*.ts`, updated `package.json` scripts |
| 15 | README, SECURITY, CONTRIBUTING, obsolete doc removal |

## Final definition of done

All must be true before calling the refactor complete:

- [x] No V1 assessment or matching code remains
- [x] No compatibility adapter or D1 fallback remains
- [x] No Workers AI call in profile/suggestion path
- [x] No user-linked profile or requester/candidate relation in D1
- [x] Raw answers deleted after profile finalization
- [x] No raw capability reference stored
- [x] Vectorize: anonymous coarse 8-d vectors only; independent random IDs for self/desired
- [x] Profile indexing revision-safe and idempotent
- [x] Final ranking deterministic and reciprocal
- [x] Safety behavior-based only; hard filters override rank
- [x] Suggestion/request flows use sealed capabilities
- [x] Accepted request → existing sealed message ticket
- [x] All vault/query operations bounded
- [x] Storage-leak verification passes
- [x] Concurrency tests pass
- [x] `pnpm check` passes
- [x] Documentation matches implementation

## Commands to run at gates

```bash
pnpm typecheck
pnpm lint
pnpm knip
pnpm test
pnpm audit:d1:local
pnpm check
```

Phase-specific verifiers added in Phases 4 and 14.
