# Conversation Suggestions

**Status:** canonical specification for Conversation Suggestions.

Conversation Suggestions is an optional discovery system based on how users describe their own conversation style and what kind of conversation they currently want. It is not a personality test, psychological diagnosis, identity verifier, safety guarantee, dating system, or exact fit score.

## Product loop

```text
conversation profile
  → explicit discoverability opt-in
  → bounded candidate retrieval
  → deterministic reciprocal ranking
  → sealed suggestion
  → optional encrypted intro
  → sealed conversation request
  → accept or decline
  → accepted request becomes a normal sealed ticket
```

Completing a profile does not make the user discoverable. Discoverability is off by default.

## Profile schema

```text
version: current
questions: 25
dimensions: 8
```

| Dimension | Meaning |
|---|---|
| `depth` | preference for light or deeper conversation |
| `replyPace` | preferred response rhythm |
| `directness` | direct versus indirect communication |
| `energy` | conversational and social energy |
| `playfulness` | humor and lightness |
| `supportStyle` | listening versus solution-oriented support |
| `disclosurePace` | pace of opening personal topics |
| `repairStyle` | handling misunderstanding and repair |

Question blocks:

| Block | Count | Purpose |
|---|---:|---|
| self style | 16 | two behavior-focused items per dimension |
| desired style | 8 | desired counterpart style, including no strong preference |
| current intent | 1 | explicit current conversation intent |

Current intent values:

```text
light
deep
support
exploration
open
```

The system does not infer demographic, clinical, political, religious, sexual, or identity attributes.

## Active session and finalization

Raw answers exist only in the active encrypted profile session in UserState.

Finalization:

1. validates profile version and complete answer count;
2. normalizes self-style values to `0..1`;
3. derives desired values and no-preference flags;
4. derives per-dimension importance;
5. calculates internal agreement/uncertainty for repeated self items;
6. records explicit current intent;
7. builds a controlled profile summary for product display;
8. stores the finalized profile encrypted in ProfileVault;
9. removes raw answer material from UserState;
10. issues a sealed profile-index Queue job.

A finalized profile has a monotonically increasing revision. Stale Queue work cannot overwrite a newer revision or restore a profile removed by reset.

## Storage model

| Plane | Stores | Does not store |
|---|---|---|
| D1 | account structure and aggregate statistics | raw answers, finalized profiles, vectors, pair edges, suggestions, request intros |
| UserState DO | encrypted active session, discoverability preference, rate budget, exposure tokens, sealed profile capability | plaintext finalized profile or pair graph |
| ProfileVault DO | encrypted finalized profile, revision, status, vector routing, sealed index-job authorization | raw capability, Telegram id, public profile graph |
| Vectorize | controlled 8-dimensional self and desired vectors | Telegram ids, display names, raw answers, request intros |
| ConversationVault DO | sealed suggestions, sealed requests, encrypted request intros, request accept lease/result | public requester/candidate relation |
| PairLedger DO | blind pair locks, cooldowns, pair blocks, pair state | reversible pair members |
| Profile-index Queue | action plus sealed index-job reference | profile JSON, user id, Telegram data |

Vaults are sharded using bounded prefixes of blind lookup hashes. D1 does not store profile or request records.

## Indexing

A finalized or changed profile produces a sealed index job. The profile-index consumer:

- resolves the sealed authorization;
- loads the current ProfileVault revision;
- rejects stale revisions;
- projects two 8-dimensional vectors;
- upserts or deletes controlled Vectorize records;
- verifies index state before marking discoverability active.

Vector metadata is minimal and excludes Telegram identity, public link, display name, raw answers, and request data.

No Workers AI model is used. Vector values are calculated directly from the profile projection.

## Retrieval

Search performs two bounded retrievals:

```text
requester's self vector    → candidate desired namespace
requester's desired vector → candidate self namespace
```

Results are intersected/merged into a bounded candidate set. Candidate profiles are resolved from ProfileVault in bounded batches.

Vectorize similarity is not the final score and is not shown to users.

## Eligibility filters

A candidate must satisfy all current product gates:

- active profile version and revision;
- discoverability enabled and index verified;
- not the requester;
- current profile/request capability ownership valid;
- pair not blocked;
- no active pair lock or cooldown preventing contact;
- recipient can receive contact;
- requester Safety decision allows initiation;
- bounded search and exposure budgets;
- no stale or terminal suggestion/request state.

Hard filters override ranking.

## Deterministic reciprocal ranking

Final ordering is pure TypeScript. It considers both directions:

```text
requester self  ↔ candidate desired
candidate self  ↔ requester desired
```

The ranker uses dimension importance, no-preference flags, confidence/uncertainty, current intent, exposure fairness, freshness, and hard policy constraints.

The product does not expose an exact fit percentage. Copy should describe current conversation options, not perfect matches.

## Suggestion lifecycle

A suggestion is a sealed capability addressed separately to requester and candidate state.

Typical states:

```text
active
converted_to_request
dismissed
expired
revoked
```

Suggestion storage contains blind lookup/proof material and encrypted route/explanation data. It does not publish candidate account ids.

Dismissal and pair rules update PairLedger without creating a D1 relationship row.

## Creating a conversation request

A request is created only when the requester writes an intro.

Before storage, the service verifies:

- requester and candidate profiles are still valid;
- candidate is still discoverable;
- requester Safety decision allows initiation;
- candidate pause/block gate allows this requester;
- a pending pair lock can be acquired;
- intro text is non-empty and bounded.

Creation sequence:

1. acquire blind pending pair lock;
2. create random request capability and blind request hash;
3. create requester/candidate owner proofs;
4. encrypt route capsule and intro;
5. store request durably in ConversationVault;
6. mark the source suggestion converted best effort;
7. emit statistics and notification after durable store.

A notification failure does not roll back a stored request.

## Request actions

### Cancel

Requester capability and owner proof are verified. The request becomes canceled and the pending pair lock is released. Repeated cancel is idempotent.

### Decline

Candidate capability and current profile ownership are verified. The request becomes declined and PairLedger records a decline cooldown. Requester notification and statistics are non-authoritative side effects.

### Accept

Accept uses a durable claim/lease in ConversationVault:

```text
operationId = conversation-request:{requestHash}
```

The operation id is also passed as the sealed-ticket `dedupeKey`.

Therefore:

- the same request always derives the same ticket capability and `ticketHash`;
- retry after a partial failure cannot create a second ticket;
- TicketVault reports `created` or `existing`;
- compensation never deletes an existing deterministic ticket;
- the accept record stores the resulting `ticketHash`;
- repeated accepted callbacks return success without another message.

The accepted intro is delivered through the standard TicketVault + unread inbox pipeline. Conversation Suggestions does not maintain a separate messaging channel.

## Blocking and Safety

Conversation requests obey the same initiation policy as anonymous messages:

- candidate block state is checked using a block tag derived from candidate current account and requester stable actor hash;
- candidate pause state is checked;
- suspended or banned requesters cannot create requests;
- accepted intros still pass the standard `createSealedTicket` gates.

This prevents suggestions from bypassing normal messaging controls.

## Reset and revocation

Hard reset must invalidate profile/discovery state before creating a new account. Old profile capabilities, suggestions, and requests fail ownership or status checks. Stale index jobs cannot re-enable deleted discovery state.

Pair and request records follow bounded retention/cooldown rules and do not create a replacement account graph.

## Performance bounds

- profile contains exactly 25 answers and 8 dimensions;
- vector projection is 8-dimensional;
- Vectorize result counts are bounded;
- ProfileVault resolution is batched and bounded;
- final ranking is deterministic and CPU-bounded;
- Queue payloads do not contain profile JSON;
- no D1 candidate retrieval or full vault scan;
- exposure and rate budgets are recipient-local or pair-local.

## Product language

Use:

```text
ارزیابی سبک گفت‌وگو
پیشنهاد گفت‌وگو
گزینه‌ی گفت‌وگو
درخواست گفت‌وگو
پیام شروع گفت‌وگو
نمایش در پیشنهادها
```

Avoid positive claims such as:

```text
تست شخصیت
درصد سازگاری
مچ کامل
دوستیابی
تشخیص روان‌شناختی
تضمین امنیت یا مناسب‌بودن فرد
```
