# Conversation Suggestions

**Status:** canonical specification for Conversation Suggestions V2.

Conversation Suggestions is an optional, reciprocal discovery system based on how users describe their conversation style and what kind of conversation they currently want.

It is not a personality test, psychological diagnosis, dating system, identity verifier, safety guarantee, or exact compatibility score.

## Product loop

```text
conversation profile
  → opt-in discoverability
  → candidate retrieval
  → deterministic reciprocal ranking
  → sealed suggestion
  → optional intro
  → sealed request
  → accept or decline
  → accepted request becomes a standard sealed message ticket
```

Discoverability is off by default. Completing a profile does not automatically expose a user to suggestions.

## Profile V2

Schema:

```text
version: v2
questions: 25
dimensions: 8
```

Dimensions:

| Dimension | Meaning |
|---|---|
| `depth` | preference for light or deeper conversation |
| `replyPace` | preferred response rhythm |
| `directness` | direct versus indirect communication |
| `energy` | social and conversational energy |
| `playfulness` | humor and lightness |
| `supportStyle` | listening versus solution-oriented support |
| `disclosurePace` | pace of opening personal topics |
| `repairStyle` | handling misunderstandings and repair |

Question blocks:

| Block | Count | Purpose |
|---|---:|---|
| self style | 16 | two behavior-focused items per dimension |
| desired style | 8 | preferred conversation counterpart; can express no strong preference |
| current intent | 1 | direct choice, not inferred |

Current intent values:

```text
light
deep
support
exploration
open
```

The system does not infer demographic, clinical, or identity attributes.

## Profile construction

Raw answers are held only in the active encrypted profile session. Finalization:

1. validates the complete session and schema version;
2. normalizes self-style answers to `0..1`;
3. records desired style and no-preference values;
4. derives per-dimension importance;
5. calculates internal agreement/uncertainty for repeated self items;
6. records current intent;
7. builds a controlled profile summary;
8. stores the finalized profile encrypted in ProfileVault;
9. removes raw answer material from the active session;
10. issues a sealed profile-index job.

A finalized profile has a monotonic revision. Stale queue jobs cannot overwrite a newer revision or restore a profile deleted by account reset.

## Storage model

| Plane | Stores | Does not store |
|---|---|---|
| D1 | account structure and aggregate statistics | answers, profiles, vectors, pair edges, suggestions, intros |
| UserState DO | active profile session, discoverability preference, rate budget, exposure tokens | finalized plaintext profile or pair graph |
| ProfileVault DO | encrypted finalized profile, vector routes, index-job capability | raw capability, plaintext profile, Telegram identity |
| Vectorize | coarse 8-dimensional vectors in controlled namespaces | Telegram IDs, display names, answers, intros |
| ConversationVault DO | sealed suggestion and request records, encrypted request intro | public candidate/requester IDs |
| PairLedger DO | blind pair state, locks, cooldowns, pair blocks | reversible pair members |
| Profile-index queue | action and sealed index-job reference | profile JSON, user ID, Telegram data |

Vaults are sharded by bounded prefixes of blind lookup hashes. They are not global singletons and are not one Durable Object per user or suggestion.

## Vector projection

The profile produces controlled 8-dimensional vectors:

```text
self vector
desired vector
```

Vectors contain normalized product values only. They are not embeddings generated from prose, and Workers AI is not used in this path.

Vector IDs and routes are recoverable through encrypted ProfileVault state. Vectorize metadata remains minimal and non-identifying. Locale separation, when required, is handled through controlled namespace or filter design rather than exposing account identifiers.

## Dual retrieval

For actor `A` and candidate `B`, reciprocal retrieval needs both directions:

```text
A.self    near B.desired
A.desired near B.self
```

The system queries bounded candidate sets from the corresponding namespaces and intersects or combines them before loading authoritative encrypted profiles.

Vectorize is a coarse retrieval layer only. A high vector similarity does not become the final score.

## Eligibility

Before ranking, candidates pass hard filters:

- actor and candidate exist and are active;
- both profiles use the current supported schema;
- both users completed the profile;
- discoverability is enabled;
- vector/profile revisions are current;
- candidate is not the actor;
- no active block or pair block;
- no conflicting pending request;
- pair cooldown and exposure rules allow presentation;
- rate and search budgets allow the operation.

Hard filters override similarity.

## Deterministic reciprocal ranking

The final ranker is pure TypeScript and receives resolved profile values, not Cloudflare bindings.

Conceptually:

```text
A self → B desired distance
B self → A desired distance
importance weighting
uncertainty adjustment
intent adjustment
exposure and cooldown policy
deterministic tie-breaking
```

Important rules:

- both directions matter;
- no-preference dimensions contribute little or no weight;
- uncertain self dimensions can receive lower effective weight;
- current intent is a small adjustment or explicit incompatibility filter, not the whole score;
- the score is an internal ordering signal, not a published compatibility percentage;
- results are described as current nearby conversation options, not guaranteed good matches.

The ranker is deterministic for the same inputs and policy version.

## Sealed capability chain

Conversation Suggestions follows the same capability philosophy as anonymous messages:

```text
Profile Capability
  → Suggestion Capability
  → Request Capability
  → Message Ticket
```

Properties:

- random short references appear only in Telegram;
- storage uses blind HMAC lookup keys;
- owner proofs bind actions to the current actor;
- route and intro material is encrypted;
- pair state uses blind tags;
- records have bounded expiry;
- raw capability references are not stored.

Callback families:

```text
m:  suggestion hub
s:  suggestion actions
q:  request actions
```

Callbacks contain no candidate IDs, requester IDs, scores, profile values, or intro text.

## Suggestion lifecycle

A search:

1. consumes the bounded search budget;
2. loads the actor profile and vector routes;
3. performs dual bounded retrieval;
4. resolves candidate profiles from ProfileVault;
5. applies eligibility and pair state;
6. runs deterministic reciprocal ranking;
7. applies exposure policy;
8. creates sealed suggestion capabilities for the top current options;
9. renders controlled explanations without exposing full profiles.

A suggestion can be viewed, dismissed, expire, or be converted into a request. The same operation is idempotent.

## Request lifecycle

The actor writes a bounded intro message. ConversationVault stores it encrypted.

Conceptual state machine:

```text
pending
  → accepting
  → accepted(ticketHash)

pending
  → declined

pending
  → canceled

pending
  → expired
```

Rules:

- transitions are compare-and-set;
- accept, decline, and cancel are mutually exclusive;
- concurrent accepts create at most one intro message ticket;
- an accept first claims `accepting(operationId)` before sealed-ticket creation;
- accepted requests store the created `ticketHash` for idempotent retries;
- retries return the same durable result;
- stable request-derived operation keys deduplicate ticket creation;
- notification delivery happens after durable request state is committed;
- a Telegram notification failure does not roll back the product state.

Accepting a request creates a normal sealed ticket. From that point onward, the participants use the standard anonymous inbox and reply flow. Nekonymous does not create a separate permanent chat transcript.

## Pair state and exposure

PairLedger stores blind pair tags for:

- request locks;
- pending and accepted state coordination;
- cooldowns;
- dismiss/decline suppression;
- pair blocks;
- bounded repeated-exposure control.

UserState stores actor-local exposure tokens where needed. Neither plane stores a reversible plaintext pair directory.

## Account reset

Hard reset disables discoverability before identity recreation, removes or revokes profile and conversation capability state, deletes known Vectorize routes, and prevents stale profile-index jobs from restoring the old vector.

Known migration boundary:

Profiles indexed after release hardening retain the encrypted Vectorize routing information needed for complete automated deletion. Some older pre-hardening records may not contain that route and can require operator cleanup. The application must not claim stronger cleanup for those historical records than it can verify.

The new identity receives a new internal ID, public link, profile capability, and pair tags.

## Rate and cost controls

The exact constants live in code. The architecture requires:

- bounded search frequency;
- bounded candidate retrieval;
- bounded profile resolution;
- bounded suggestions per search;
- bounded request creation;
- bounded pending request rendering;
- pair cooldowns;
- exposure limits;
- no global vault scan;
- no Workers AI call;
- no D1 profile graph.

These controls limit abuse, Worker CPU, subrequests, and Vectorize cost.

## Public language

Use:

```text
conversation profile
conversation suggestions
current nearby options
conversation request
intro message
```

Avoid:

```text
personality test
diagnosis
compatibility percentage
perfect match
dating match
AI personality inference
```

## Source map

Current implementation areas:

```text
src/features/conversation/profile/
src/features/conversation/suggestions/
src/features/ticketing/conversation-*.ts
src/storage/profile-vault/
src/storage/conversation-vault/
src/storage/pair-ledger/
src/queues/profile-index-consumer.ts
```

## Verification

```bash
pnpm test:conversation-v2-resources
pnpm test:conversation-capabilities
pnpm test:conversation-privacy
pnpm test:conversation-profile
pnpm test:conversation-index
pnpm test:conversation-retrieval
pnpm test:conversation-ranking
pnpm test:conversation-eligibility
pnpm test:conversation-suggestions
pnpm test:conversation-requests
pnpm test:profile-index-idempotency
pnpm run check
```
