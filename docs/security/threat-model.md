# Threat Model

**Scope:** Nekonymous — Persian-first Telegram-bot-only hosted anonymous relay on Cloudflare.

**Status:** V2 conversation profile + suggestions refactor (canonical architecture in [conversation-suggestions-v2.md](../architecture/conversation-suggestions-v2.md)). Legacy V1 assessment/matching tables and code are being removed; this document describes the **target** V2 system.

See also [README](../../README.md) and [SECURITY.md](../../SECURITY.md).

## Scope

This model covers:

- Anonymous deep-link messaging and replies
- Inbox sealed-ticket storage and delivery
- Block, report, private nickname, pause/resume
- Conversation profile questionnaire and optional conversation suggestions (V2)
- Account hard reset
- Storage in D1, Durable Objects, KV, Queues, Vectorize

This model does **not** cover Telegram client security, user device compromise, or Cloudflare platform guarantees beyond configured bindings.

## Non-goals

Nekonymous intentionally does **not** provide:

- E2EE or zero-knowledge delivery
- Perfect anonymity or untraceability
- Hiding message plaintext from Telegram
- Hiding plaintext from the Worker during processing
- Clinical, personality, or psychological inference products
- Dating compatibility or exact relationship matching
- Payment or subscription security

## Actors

| Actor | Role |
|-------|------|
| Message sender | Opens deep link or replies; may abuse rate limits |
| Recipient | Reads inbox, replies, blocks, reports, sets nicknames |
| Telegram | Delivers updates and messages; sees plaintext in transit |
| Worker / runtime operator | Processes webhooks; sees plaintext during handling |
| Database / storage attacker | Exports D1, DO SQLite, KV, Vectorize, or queue payloads |
| Abusive user | Floods, harasses, retries after blocks |
| External attacker | Webhook forgery, secret theft, binding misuse |

## Trust boundaries

| Boundary | Trust assumption |
|----------|------------------|
| **Telegram** | Sees messages and metadata for accounts using Telegram |
| **Worker** | Sees plaintext while validating, encrypting, decrypting, and relaying |
| **D1** | Identity + anonymous aggregate stats only — **no** profile or pair graph |
| **UserStateDO** | Per-user session, exposure tokens, rate limits — not finalized profile bodies |
| **ProfileVaultShardDO** | Encrypted profiles and blind vector routes |
| **ConversationVaultShardDO** | Sealed suggestion/request capabilities |
| **PairLedgerShardDO** | Blind pair locks and cooldowns |
| **TicketVaultDO** | Sealed message route + payload capsules |
| **ReportLedgerDO** | Blind abuse tags |
| **KV** | Eventually consistent routing cache only |
| **Queues** | At-least-once delivery; profile index jobs carry capability refs only |
| **Vectorize** | Anonymous coarse 8-d vectors; no user linkage in IDs or metadata |
| **User device** | Recipient or sender may screenshot, forward, or leak content |

## Data classes (V2)

| Class | Where it lives | Notes |
|-------|----------------|-------|
| Telegram user id | HMAC → `telegram_user_hash` in D1 | Raw id not stored |
| Telegram chat id | AES ciphertext in D1 | Decrypted only in Worker |
| Public link slug | D1 `public_links` | Shareable by design |
| Anonymous message payload | TicketVault `payload_enc` | Cleared after inbox delivery |
| Route metadata | TicketVault `route_enc` | Encrypted; kept until expiry for actions |
| Inbox callback ref | Telegram buttons only | Not stored raw |
| Display name / nickname | UserStateDO ciphertext | Recipient or visitor context |
| Profile session answers | UserStateDO encrypted session | **Deleted** after successful finalization |
| Finalized profile | ProfileVaultShard `profile_enc` | No `user_id` column; blind lookup hash |
| Vector routes | ProfileVaultShard | Independent random Vectorize IDs per self/desired |
| Suggestion ticket | ConversationVaultShard | Blind hashes; encrypted explanation |
| Request intro | ConversationVaultShard `intro_enc` | Cleared on terminal request state |
| Pair state | PairLedgerShard | Blind `pair_tag` only |
| Exposure token | UserStateDO | Short-lived blind token for rerank |
| Aggregate stats | D1 `platform_daily_*` | No user ids |

## Storage model (V2)

```text
D1                    → users, public_links, platform_daily_stats (aggregate only)
UserStateDO           → inbox pointers, drafts, blocks, labels, profile session,
                        exposure tokens, rate limits
ProfileVaultShardDO   → encrypted profiles, vector routes, index-job capabilities
ConversationVaultShardDO → suggestion + request capabilities
PairLedgerShardDO     → blind pair locks, cooldowns, pair blocks
TicketVaultDO         → sealed message tickets
ReportLedgerDO        → blind report tags
TelegramOutboxDO      → idempotent outbound send log
KV                    → tg:{hash}, link:{slug} cache only
Vectorize             → 8-d coarse vectors in role/locale namespaces
Profile index queue   → indexJobRef + action only
```

D1 must **not** contain: assessment answers, conversation profiles, profile vectors, `requester_user_id` / `candidate_user_id`, intro text, suggestion history, or per-user exposure history.

## Capability chain

```text
Profile Capability → Suggestion Capability → Request Capability → Message Ticket
```

Raw capability strings are request-only (Telegram callbacks). Storage uses blind lookup hashes and encrypted capsules. Actor-bound owner proofs required for mutating operations.

## Key separation

HKDF domain-separated keys (see V2 architecture doc): profile lookup/encryption, vector lookup, suggestion/request lookup, pair tags, owner proofs, exposure tokens, outcome bucketing. Do not reuse the same stable actor tag across messaging, profile, suggestion, request, and exposure planes.

## What is encrypted at rest

- Telegram chat ids (AES-256-GCM, `APP_MASTER_KEY`)
- Message payloads and route capsules (per-ticket HKDF-derived keys)
- Profile, suggestion, and request capsules in vault shards
- Display names and private nicknames
- Request intro text until terminal state
- Telegram chat routing in outbox jobs (`chatCiphertext`)

Encryption at rest does **not** mean Telegram or the Worker never see plaintext during delivery.

## What is visible while processing

**Telegram:** message text/media, chat and user identifiers on Telegram's side.

**Worker:** plaintext during encrypt/decrypt/relay; decrypted profile only during ranking after vault authorization; questionnaire answers only during active session until finalization.

## Leak-resistance target (without Worker secrets)

Independent storage leaks should expose at most:

```text
opaque hashes, encrypted capsules, anonymous coarse vectors,
blind pair tags, aggregate counters
```

Must **not** expose: Telegram IDs, internal user IDs, display names, raw answers, profile-to-user relationships, requester/candidate relationships, message intros, or reconstructable social graphs.

### D1-only leak

**Cannot directly read:** message bodies, raw Telegram ids, profiles, pair edges, intros.

**Can read:** internal user ids, public slugs, anonymous aggregate stats.

### Vectorize-only leak

**Cannot directly read:** which self and desired vectors belong to the same person (independent random IDs).

**Can read:** coarse 8-dimensional vectors in namespace buckets.

### DO vault leak (without keys)

Ciphertext and blind hashes only — no plaintext profile JSON or user linkage columns.

**With application secrets:** vault ciphertext becomes decryptable in Worker context. This model does not claim protection against runtime or key compromise.

## Abuse controls

| Control | Implementation |
|---------|----------------|
| Global action throttle | 1 s per user (`UserStateDO`) |
| Inbox cap | Bounded active pointers per user |
| Block before send/reply | UserState `blocks` |
| Blind reports | ReportLedger DO |
| Pair pending lock | PairLedgerShard DO |
| Dismiss / accept / decline cooldowns | PairLedgerShard DO |
| Search and request rate budgets | UserStateDO + configurable limits |
| Webhook auth | `BOT_SECRET_KEY` secret token |
| Webhook idempotency | `processed_events` in UserState DO |

**Safety** derives from blocks, reports, spam, rate limits, and moderation — **never** from questionnaire answers (no `safety_tier`, `restricted` from profile scores).

## Matching / suggestions (V2)

- Vectorize: **retrieval only** — dual-channel topK in self/desired namespaces
- Ranking: **deterministic reciprocal TypeScript** on decrypted profiles — Vectorize similarity not in final score
- No D1 candidate fallback
- No compatibility percentages in UI
- Accepted request → existing sealed inbox ticket path

## Retention (V2)

| Data | Policy |
|------|--------|
| Raw session answers | Delete after successful profile finalization |
| Suggestion tickets | 2 h TTL |
| Request intros | Clear on accept/decline/cancel/expiry |
| Request capabilities | 72 h max |
| Profile vectors | Delete on discoverability off (Vectorize propagation delay) |
| Exposure tokens | Short TTL in UserStateDO |

## Future learning (disabled at V2 launch)

Internal event contract prepared for coarse pair buckets and outcomes — **not** written to D1 until separate review of sample size, retention, aggregation threshold, and re-identification risk.

## Forbidden public claims

Do not claim: perfect anonymity, E2EE, zero-knowledge, exact compatibility, clinical/personality diagnosis, dating compatibility, or «secure messenger» positioning.

Run `pnpm audit:d1` for repeatable D1 checks (identity + stats only in V2).
