# Conversation Suggestions V2

**Status:** canonical architecture — implemented (pre-release `pre-release-conversation-v2-acca6b9`).  
**Replaces:** removed V1 assessment/matching implementation and D1 profile graph.

See also [threat-model.md](../security/threat-model.md), [sealed-ticket-routing-and-inbox.md](./sealed-ticket-routing-and-inbox.md), [bot-interaction-v1.md](./bot-interaction-v1.md) (UX routing; callback prefixes updated below).

## Mission

Privacy-preserving, reciprocal, Cloudflare-native **conversation profile** + **conversation suggestions**. Not personality testing, clinical diagnosis, dating compatibility, AI personality inference, or exact compatibility scoring.

**Clean slate:** no V1 assessment profiles, answers, match records, embeddings, callbacks, scoring, D1 fallbacks, or dual reads/writes.

## Runtime flow

```text
Telegram / grammY
        ↓
UserStateDO                    (session, exposure, rate budgets)
        ↓
ProfileVaultShardDO            (encrypted profiles, vector routes, index jobs)
        ↓
Profile Index Queue            (upsert | delete | verify)
        ↓
Vectorize dual retrieval       (self ↔ desired namespaces)
        ↓
Reciprocal TypeScript ranker   (pure, deterministic)
        ↓
Suggestion capability          (ConversationVaultShardDO)
        ↓
Request capability             (ConversationVaultShardDO + PairLedgerShardDO)
        ↓ accepted
Existing sealed message ticket (TicketVaultDO + inbox pointers)
```

## Capability chain

Same security philosophy as sealed messaging:

```text
Profile Capability → Suggestion Capability → Request Capability → Message Ticket
```

Properties:

- Random references presented in Telegram only
- Blind HMAC lookup keys in storage
- Actor-bound owner proofs
- Encrypted route capsules and temporary payloads
- Blind pair tags
- Short expirations
- **Raw capability references never stored**

## Storage planes

| Plane | Authority | Must not store |
|-------|-----------|----------------|
| **D1** | `users`, `public_links`, aggregate `platform_daily_*` | Profiles, answers, vectors, pair edges, intros, exposure history |
| **UserStateDO** | Profile session, discoverability pref, exposure tokens, rate limits | Finalized profile body, pair relations |
| **ProfileVaultShardDO** | Encrypted profiles, vector routes, index-job capabilities | `user_id`, `profile_ref`, raw answers, plaintext profile JSON |
| **ConversationVaultShardDO** | Suggestion/request capabilities, encrypted intros | Candidate/requester IDs, scores in callbacks |
| **PairLedgerShardDO** | Blind pair state, locks, cooldowns, pair blocks | Reversible pair members |
| **Vectorize** | Coarse 8-d vectors in namespaces | User IDs, discoverability, locale in metadata (locale in namespace only) |
| **Profile index queue** | `action`, `indexJobRef`, attempt/schema version | User ID, vectors, profile JSON, Telegram data |

Sharding: **ProfileVaultShardDO**, **ConversationVaultShardDO**, **PairLedgerShardDO** shard by a bounded prefix of blind lookup hash — not per-user, not global singleton, not per-suggestion.

## Key separation (HKDF domains)

Independent derived keys — do not reuse stable actor tags across planes:

| Domain | Purpose |
|--------|---------|
| `K_PROFILE_LOOKUP` | Blind profile vault lookup |
| `K_PROFILE_ENCRYPTION` | Profile capsule encryption |
| `K_VECTOR_LOOKUP` | Vector route vault lookup |
| `K_SUGGESTION_LOOKUP` | Suggestion vault lookup |
| `K_REQUEST_LOOKUP` | Request vault lookup |
| `K_PAIR` | Blind pair tags |
| `K_OWNER_PROOF` | Actor ownership proofs |
| `K_EXPOSURE` | Exposure tokens in UserStateDO |
| `K_OUTCOME` | Future aggregate outcome bucketing (not enabled in V2 launch) |

Implement via existing `src/features/ticketing/hkdf.ts` with explicit info strings per domain.

## Profile schema

### Dimensions (exactly eight)

| Key | Meaning |
|-----|---------|
| `depth` | Conversation depth preference |
| `replyPace` | Response timing rhythm |
| `directness` | Blunt vs indirect communication |
| `energy` | Social/chat energy level |
| `playfulness` | Humor and lightness |
| `supportStyle` | Emotional support vs problem-solving |
| `disclosurePace` | How quickly personal topics open |
| `repairStyle` | Handling misunderstandings |

### Profile shape

```ts
type ConversationProfile = {
  selfStyle: Record<Dimension, number>;      // 0..1 normalized
  desiredStyle: Record<Dimension, number>;   // 0..1 or no-preference sentinel
  importance: Record<Dimension, number>;     // 0 = no preference; else weighted
  currentIntent: Intent;
  locale: "fa" | "en";
  revision: number;                          // monotonic, starts at 1
};
```

### Current intent (direct selection, not inferred)

| Value | Use |
|-------|-----|
| `light` | Casual, low-pressure chat |
| `deep` | Substantive conversation |
| `support` | Listening / emotional support |
| `exploration` | New topics and perspectives |
| `open` | No strong mode filter |

Intent may apply a **small** ranking adjustment or act as a **hard filter** only for explicitly incompatible modes. It must not dominate the eight dimensions.

## Questionnaire

**Schema version:** `v2`  
**Total:** 25 questions

| Block | Count | Rule |
|-------|-------|------|
| Self-style | 16 | 2 per dimension; Likert 1–5 → normalized 0..1 |
| Desired-style | 8 | 1 per dimension; includes «ترجیح قوی ندارم» (no preference) |
| Current intent | 1 | Direct single-choice (not inferred) |

Rules:

- One concept per question; behaviorally understandable wording
- No moral virtue questions; no reverse-worded items; no personality labels
- No demographic questions for ranking
- Questions **interleaved** across dimensions (not blocked by dimension)
- Persian-first copy; English parity for basic flow

### Internal uncertainty (self-style only)

Two items per axis may yield an internal **agreement** value used only to:

- Reduce effective weight of uncertain axes in ranking
- Avoid overconfident explanations
- Support future questionnaire calibration

Must **not**: reject users, label psychological reliability, show confidence %, or drive moderation.

### Importance from desired-style

- No-preference answer → `importance[dimension] = 0`
- Explicit preference → dimension-specific non-zero weight (fixed constants in code, not user-tunable in V2)

## Profile state machine

```text
empty → answering → ready_to_submit → private → indexing → discoverable → disabled
```

Exceptional states: `index_failed`, `invalidated`, `restricted`

| Transition | Trigger |
|------------|---------|
| `empty` → `answering` | User starts questionnaire |
| `answering` → `ready_to_submit` | All required answers present |
| `ready_to_submit` → `private` | Successful finalization (vault write + session close) |
| `private` → `indexing` | Index job accepted |
| `indexing` → `discoverable` | Both self and desired vectors verified in Vectorize |
| `*` → `disabled` | User disables discoverability or retake |
| `indexing` → `index_failed` | Permanent index failure (recoverable retry path stays `private`) |
| `*` → `invalidated` | Hard reset / crypto rotation policy |
| `*` → `restricted` | Moderation only (blocks, reports, abuse — **never** from questionnaire answers) |

**Retake:** new `revision`; discoverability disabled immediately; old vectors scheduled for delete.

## Suggestion state machine

```text
created → viewed → dismissed | converted_to_request → expired
```

| State | Meaning |
|-------|---------|
| `created` | Ticket written; callback valid |
| `viewed` | Shown to requester (optional transition) |
| `dismissed` | User dismissed; pair cooldown via PairLedger |
| `converted_to_request` | Consumed by request creation |
| `expired` | Past `expires_at` |

**Suggestion TTL (canonical):** **2 hours** from `created_at`.

## Request state machine

```text
pending → accepted | declined | canceled | expired
```

| Terminal | Side effects |
|----------|--------------|
| `accepted` | Sealed inbox ticket; `intro_enc` cleared |
| `declined` | `intro_enc` cleared; declined cooldown |
| `canceled` | `intro_enc` cleared; pending lock released |
| `expired` | `intro_enc` cleared; pending lock released |

**Request capability TTL (canonical):** **72 hours** from `created_at`.

## Profile finalization (atomic product semantics)

```text
validate complete session
→ build profile
→ encrypt profile capsule
→ save private profile revision (ProfileVaultShardDO)
→ create one-time index-job capability
→ delete raw answers (UserStateDO)
→ enqueue index job
→ close session
```

Failure handling:

| Failure | Behavior |
|---------|----------|
| Vault persistence fails | Keep session; do not enqueue; do not claim completion |
| Queue submit fails | Profile stays `private` / `index_failed`; not discoverable |

## Indexing pipeline

### Queue message (`ProfileIndexJob`)

```ts
type ProfileIndexJob = {
  action: "upsert" | "delete" | "verify";
  indexJobRef: string;   // one-time capability
  schemaVersion: "v2";
  attempt: number;
};
```

Must **not** contain: user ID, profile vector, profile JSON, raw `profileRef`, Telegram data, display name.

### Upsert flow

```text
resolve one-time indexJobRef
→ load current profile revision
→ reject stale revision (ack, no mutation)
→ project coarse vector (quantize to 0.00, 0.25, 0.50, 0.75, 1.00)
→ create two independent random Vectorize IDs
→ save blind vector-route mappings in ProfileVaultShardDO
→ upsert self vector
→ upsert desired vector
→ schedule verify job
```

### Vectorize namespaces

```text
self-v2-fa, desired-v2-fa, self-v2-en, desired-v2-en
```

Index: `nekonymous-conversation-v2` — **euclidean** metric. Do not reuse 1024-d `nekonymous-profile-vectors`.

**Semantic dimension count:** 8 (quantized self/desired projection).  
**Vectorize index dimension count:** 32 — Cloudflare Vectorize requires `[32, 1536]` per index; values are zero-padded after the first 8 semantic dimensions. Euclidean distance on padded vectors equals distance on the 8-d semantic slice (identical tail dimensions add zero delta).

Vectorize stores: random ID, padded vector values, namespace. Optional metadata: `schemaVersion` only — no user id, locale, or discoverability flag in metadata (locale lives in namespace string only).

Full normalized values remain inside encrypted profile; ranking uses decrypted profile, not quantized vectors.

### Discoverability rule

```text
private → indexing → indexed → discoverable
```

Discoverable only after **both** vector IDs verify present. No D1 candidate fallback.

### Idempotency

At-least-once queue delivery: stale revision → ack; completed revision → ack; malformed → DLQ after retries; use per-message ack and DLQ binding.

## Candidate retrieval

Dual channel:

```text
requester.desiredVector → query candidate self namespace
requester.selfVector    → query candidate desired namespace
```

Bounds (initial):

| Limit | Value |
|-------|-------|
| topK per channel | 30 |
| max merged vector hits | 60 |
| max profiles after dedupe | 50 |
| max concurrent vault resolves | 4 |

Pipeline:

```text
two Vectorize queries
→ merge vector IDs
→ batch resolve vector routes (vault shards)
→ dedupe profiles in memory
→ reject requester profile
→ load bounded encrypted candidate profiles
→ lightweight hard filters
→ exact reciprocal rank
→ safety + pair checks for top subset only
```

No D1 scan, no fallback scan, no unbounded `Promise.all`, no N+1 loops.

## Reciprocal ranking

Pure deterministic TypeScript — **no Vectorize score in final pair score**.

### Directional fit

- **A wants B:** candidate B `selfStyle` vs requester A `desiredStyle` with A's `importance`
- **B wants A:** requester A `selfStyle` vs candidate B `desiredStyle` with B's `importance`

### Reciprocal fusion

Conservative bilateral fusion (e.g. harmonic mean) so one weak direction cannot be hidden.

### Explanations

From exact profile differences only:

- Up to **two** aligned dimensions
- Up to **one** meaningful difference

Never: compatibility %, «best match», personality labels, AI psychological copy.

## Eligibility and safety

Hard filters **override** all scores:

- Current profile revision matches
- Profile discoverable, not restricted
- Supported locale
- Not requester self
- No pair block (PairLedger or messaging block where applicable)
- No pending request lock
- No active dismiss / accept / decline cooldown
- Requester search budget and candidate incoming-request budget

Safety sources **only:** blocks, reports, spam, rate-limit abuse, moderation actions. Questionnaire answers must never produce `limited`, `restricted`, `unsafe`, or `trusted` states.

### Exposure (UserStateDO)

Blind short-lived exposure tokens only. Reranking:

- Recently shown → penalty
- Dismissed → cooldown (PairLedger)
- Low exposure → small boost
- Pending or blocked pair → exclude
- At most **one** exploration slot if already above minimum reciprocal threshold

No global popularity, no public profile score, no D1 exposure table.

## Vault record shapes (logical)

### Profile vault row

```text
profile_hash, owner_proof_tag, profile_enc, route_enc, revision, status, timestamps
```

### Vector route row

```text
vector_hash, vector_route_enc, role (self|desired), revision, status
```

Independent random Vectorize IDs — a Vectorize leak must not link self+desired to same person.

### Suggestion ticket

```text
suggestion_hash, requester_proof_tag, candidate_route_enc,
pair_tag, explanation_enc, status, created_at, expires_at
```

### Request ticket

```text
request_hash, requester_proof_tag, candidate_proof_tag,
requester_route_enc, candidate_route_enc, intro_enc,
status, created_at, expires_at
```

## Telegram surface (V2)

Commands preserved: `/assessment`, `/match` (handlers target V2 modules).

### Callback prefixes

| Prefix | Owner |
|--------|-------|
| `t:` | Profile questionnaire flow |
| `m:` | Suggestion hub navigation (search, pending, profile, discoverability) |
| `s:` | **Suggestion ticket** actions (`s:{suggestionRef}`) |
| `q:` | **Request ticket** actions (`q:{requestRef}`) |
| `st:` | Settings (migrated from V1 `s:` to free `s:` for suggestions) |
| `r:`, `b:`, `u:`, `n:`, `rp:`, `ib:` | Inbox (unchanged) |

Callback payloads must not include candidate ID, profile ID, user ID, score, or locale.

## Retention policy

| Data | Retention |
|------|-----------|
| Unfinished session answers | Until submit, cancel, expiry, or reset |
| Completed raw answers | **Delete immediately** after successful profile finalization |
| Profile capsules | Until hard delete / invalidation |
| Suggestion tickets | **2 hours** TTL |
| Request intro (`intro_enc`) | Delete on accept, decline, cancel, or expiry |
| Request capability | **72 hours** max |
| Profile vectors | Delete when discoverability disabled (Vectorize propagation delay acknowledged) |
| Dismiss / accept / decline cooldowns | Bounded TTL in PairLedgerShardDO |
| Exposure tokens | Short TTL in UserStateDO (e.g. 7 days max window for rerank) |
| Aggregate stats | Indefinite anonymous counters (existing policy) |

## Statistics (aggregate only)

Canonical reference: [platform-stats-engine.md](./platform-stats-engine.md).

All product stats go through `src/stats/product-events.ts` → `neko-stats` queue → D1. Failures never break user flows.

**Profile + index**

```text
profile_started, profile_completed,
profile_index_requested, profile_indexed, profile_index_failed,
discoverability_enabled, discoverability_disabled
```

**Suggestions + requests**

```text
suggestion_search, suggestion_shown, suggestion_dismissed,
request_sent, request_accepted, request_declined, request_canceled
```

**Safety**

```text
block_created, report_created
```

Lazy expiry of suggestion/request capabilities is **not** emitted separately; terminal actions above are the counters.

**Future learning (disabled in V2 launch):** internal contract only for coarse pair feature bucket, rank position bucket, terminal outcome, day bucket — no pair-level D1 rows until separate privacy review.

## Module layout (target)

```text
src/features/conversation-profile/     # questionnaire, build, finalize
src/features/conversation-suggestions/   # retrieval, eligibility
src/features/conversation-ranking/       # directional, reciprocal, explanations
src/storage/profile-vault/               # ProfileVaultShardDO + RPC client
src/storage/conversation-vault/          # ConversationVaultShardDO + RPC client
src/storage/pair-ledger/                 # PairLedgerShardDO + RPC client
src/queues/profile-index.types.ts
src/queues/profile-index-consumer.ts
```

## Explicit non-goals

- V1 migration or dual-read/write
- Workers AI / text embeddings for matching
- D1 profile or pair graph
- Compatibility percentages in UI
- Safety tier from questionnaire
- Repository layers or generic frameworks

## Implementation rule

Do not patch V1. Delete it. Build profile, retrieval, ranking, and request flows on sealed capabilities, bounded Cloudflare primitives, and reciprocal recommendation semantics.
