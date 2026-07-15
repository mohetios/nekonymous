# Threat Model

**Status:** canonical security and privacy model for the current `master` branch.

This document describes what Nekonymous is designed to protect, what data each storage plane can expose, and which risks remain outside the product's guarantees.

## System statement

Nekonymous is a hosted anonymous Telegram relay with encryption at rest and capability-gated actions.

It is not end-to-end encrypted, zero-knowledge, perfectly anonymous, or independent of Telegram and Cloudflare trust.

## Security objectives

Nekonymous aims to:

- hide normal sender identity from message recipients;
- prevent callback use by the wrong Telegram actor or a reset account;
- avoid plaintext anonymous message bodies in D1 and KV;
- avoid a plaintext sender-recipient graph in D1;
- minimize joinable relationship data across storage planes;
- clear message payloads after successful Telegram delivery;
- bound inbox, ticket, report, outbox, profile, and request retention;
- enforce pause, block, Safety sanctions, expiry, and request state server-side;
- tolerate duplicate Queue delivery and partial retries without duplicate logical effects;
- avoid logging message content, capabilities, raw Telegram identifiers, or secrets.

## Trust boundaries

### Telegram

Telegram receives plaintext messages from senders and plaintext deliveries to recipients. Telegram controls chat accounts, message history, callback delivery, file identifiers, and Bot API availability.

### Cloudflare Worker runtime

The Worker receives plaintext while processing and holds application secrets needed to encrypt/decrypt stored data. A compromised Worker deployment or secret set can access messages processed during that compromise.

### Cloudflare storage

D1, Durable Objects, KV, Queues, and Vectorize are separate logical planes but share the Cloudflare account trust boundary. Application design minimizes what each plane stores; it does not make the platform untrusted.

### Project operator

An operator with deployment credentials and application keys can deploy code that observes plaintext or decrypts stored ciphertext. The architecture reduces accidental exposure and database joinability; it does not remove operator power.

### Telegram users

Senders and recipients may be malicious. Recipients can copy, screenshot, forward, or publish messages. A user may automate Telegram input, replay callbacks, or coordinate abusive reports.

## Protected assets

- Telegram bot token and webhook secret;
- application master key and HMAC pepper;
- raw Telegram user and chat identifiers;
- anonymous message content and media references;
- ticket capabilities and derived keys;
- encrypted route metadata;
- private nicknames and block state;
- active profile answers and finalized conversation profiles;
- suggestion/request capabilities and encrypted request intros;
- blind safety subject and reporter tags;
- deployment and Cloudflare credentials.

## Storage exposure by plane

| Plane | Stored data | Important exclusions |
|---|---|---|
| D1 | active user rows with HMACed Telegram actor hash, encrypted chat route, public links, aggregate daily statistics, bounded stats event receipts | message bodies, ticket capabilities, finalized profiles, suggestions, request intros, pair graph |
| KV | best-effort `tg:{hash}` and `link:{slug}` routing cache, short stats cache | message/profile/inbox authority, plaintext Telegram id |
| UserState DO | sealed unread capabilities, blind dedupe, delivery leases, drafts, block tags, encrypted nicknames, rate state, encrypted active profile session, discoverability/exposure state | message body, ticket hash, plaintext capability, global relation graph |
| TicketVault DO | blind ticket hash, owner proof, encrypted route/payload/meta, status and expiry | raw capability, direct sender/recipient ids, transcript |
| SafetyState DO | blind report events, distinct-reporter tags, reason code, sanction state | message body, reversible subject/reporter identity |
| ProfileVault DO | encrypted finalized profile, revision/status, sealed index authorization | raw Telegram id, D1 profile row |
| ConversationVault DO | sealed suggestions/requests, encrypted route and intro, accept lease/result | public pair graph, D1 request relation |
| PairLedger DO | blind pair lock, cooldown, block, state | reversible account pair |
| TelegramOutbox DO | encrypted chat route in jobs, method/payload needed for send, idempotency/lease/error metadata | permanent transcript or unbounded log |
| Queue | bounded job payloads and references | long-lived authority; profile JSON in index jobs; ticket capability in unread notification jobs |
| Vectorize | controlled 8-dimensional self/desired vectors and minimal routing metadata | raw answers, Telegram ids, display names, intros, final rank authority |

## Ticket capability exposure

Before delivery, the capability exists as authenticated ciphertext in the recipient UserState unread row.

After delivery, the capability appears in Telegram callback data attached to the delivered ticket message. TicketVault never stores the raw capability.

Capability possession alone is insufficient. The Worker verifies an owner proof bound to:

```text
recipient stable Telegram actor hash
+ recipient current internal account id
+ ticketHash
```

Residual risk: a compromised recipient Telegram account can use callbacks available to that same account until expiry. The capability is intentionally a bearer component inside an actor-bound authorization check.

## Threats and mitigations

### 1. D1 disclosure

**Threat:** database inspection reveals anonymous content or a social graph.

**Mitigations:**

- no anonymous message body or ticket route in D1;
- no finalized profile or request/pair graph in D1;
- Telegram user ids are HMACed;
- chat ids are encrypted;
- aggregate statistics are not user timelines;
- automated D1 audit checks forbidden columns and data shapes.

**Residual risk:** user and public-link structure remains visible, and an attacker with application secrets can resolve HMAC/encrypted identity material.

### 2. Durable Object disclosure

**Threat:** storage dump reveals messages, routes, profiles, or relationship state.

**Mitigations:**

- route/payload/meta/profile/intro data encrypted at rest;
- lookup keys and relationship tags are blind and domain separated;
- UserState does not contain plaintext capability or ticket hash;
- vaults are sharded and not globally scanned;
- payload cleared after successful delivery;
- bounded expiry and cleanup.

**Residual risk:** ciphertext length, timestamps, row counts, status, and access patterns are metadata. Application-key compromise defeats encryption at rest.

### 3. Capability guessing or tampering

**Threat:** attacker guesses a ticket reference or changes callback data.

**Mitigations:**

- 256-bit capability material;
- canonical Base64URL parser;
- blind HMAC lookup;
- AES-GCM authenticated capsules and domain-specific AAD;
- actor/account-bound owner proof;
- expiry and status checks.

**Residual risk:** capability copied from a compromised recipient account remains usable by that account while authorization and lifecycle permit.

### 4. Cross-user inbox access

**Threat:** one actor drains another recipient's unread queue.

**Mitigations:**

- `/inbox` and `ib:d` resolve the current Telegram actor to the current internal account;
- UserState is addressed by internal account id;
- opened ticket owner proof must match current actor/account;
- Queue job contains the recipient account id but no capability and is validated at runtime.

### 5. Queue duplication and crash windows

**Threat:** at-least-once delivery sends duplicate notifications/messages or corrupts state.

**Mitigations:**

- random notification event id and stable Outbox idempotency key;
- `ticket-delivery:{ticketHash}` delivery idempotency;
- per-chat lanes, locks, leases, and bounded retention;
- truthful UserState attempt results;
- claim/release/complete requires matching attempt id;
- deterministic capability for request accept;
- compensation deletes only a ticket created by the current invocation.

**Residual risk:** a platform crash after Telegram accepts a message but before local success persistence can cause a retry. Telegram's Bot API does not provide an application transaction with Worker storage; idempotency reduces but cannot cryptographically eliminate every external side-effect ambiguity.

### 6. Destructive retry or stale worker

**Threat:** a temporary error or expired worker deletes a healthy ticket.

**Mitigations:**

- unexpected DO/storage/crypto errors release and retry;
- permanent orphan classification is explicit;
- orphan cleanup first completes the exact unread claim;
- stale attempt cannot delete TicketVault;
- unread/ticket state is retained on transient failure.

### 7. Block bypass

**Threat:** blocked sender uses reply, reset, or conversation suggestions to initiate contact.

**Mitigations:**

- `blockTag` binds recipient current account to sender stable actor hash;
- receive gate runs for direct messages, replies, and request creation;
- accepted request uses normal sealed-ticket gates;
- sender account reset does not change stable actor hash.

**Residual risk:** recipient account reset clears recipient-local blocks by design.

### 8. Report manipulation

**Threat:** duplicate or coordinated reports incorrectly sanction someone.

**Mitigations:**

- duplicate same-ticket/same-reporter event tag;
- distinct reporter count scoped to one abuse subject;
- reporter tag is not globally joinable;
- phase-specific time windows;
- runtime reason-code allowlist;
- report event retention and operator clear path.

**Residual risk:** coordinated distinct Telegram accounts can still trigger automated thresholds. Sanctions are an abuse-control heuristic, not a proof of misconduct.

### 9. Safety reset bypass

**Threat:** suspended or banned actor resets account.

**Mitigation:** SafetyState is addressed by an abuse subject derived from the stable Telegram actor hash, not the current internal account id.

### 10. Profile/request privacy leakage

**Threat:** D1/Vectorize reveals questionnaire answers or a relationship graph.

**Mitigations:**

- raw answers only in encrypted active session and deleted after finalization;
- finalized profile encrypted in ProfileVault;
- Vectorize stores controlled 8-dimensional projections only;
- no Workers AI;
- request intros encrypted in ConversationVault;
- pair state uses blind PairLedger tags;
- stale index revision checks prevent reset rollback.

**Residual risk:** vector values and controlled metadata reveal approximate conversation-style projection. Vectorize access must still be treated as sensitive infrastructure access.

### 11. Reset inconsistency

**Threat:** user believes reset completed while old discoverability or ticket authority remains.

**Mitigations:**

- profile invalidation must succeed before identity rotation;
- UserState is purged and D1 identity is hard-deleted;
- public links and KV routes are removed;
- new internal id invalidates old ticket owner proofs;
- stale profile-index work cannot restore a deleted revision.

**Residual risk:** physical removal of every old encrypted vault record is bounded and may be completed by expiry/cleanup after logical access has already been revoked.

### 12. Logging leakage

**Threat:** production logs contain messages, raw IDs, capabilities, ciphertext, tags, tokens, or full error objects.

**Mitigations:**

- generic user-facing errors;
- stage-based `logBotError` calls;
- safe metadata limited to retry/permanent status, delay, and timing;
- no message body or identity fields in timing logs;
- audits and review rules prohibit sensitive logs.

## Retention summary

| Data | Normal lifecycle |
|---|---|
| Ticket payload | until successful delivery, permanent orphan cleanup, reset cleanup, or 30-day expiry |
| Ticket route/meta | up to 30 days |
| Unread item | until delivery, orphan completion, reset, or expiry |
| TelegramOutbox event | 7 days |
| Safety report event | 90 days |
| Sanction state | until policy transition or operator clear; ban is indefinite |
| Draft | explicit TTL or 24-hour default |
| Active profile answers | until finalization, abandonment expiry, or reset |
| Finalized profile | until replacement, deletion, or reset |
| Suggestion/request | bounded capability/status lifecycle |
| Block/nickname | until recipient changes it or resets |
| Aggregate statistics | retained as anonymous aggregates and not decremented on reset |
| Stats event receipt | 35-day bounded idempotency marker for aggregate Queue processing |

## Explicit non-goals

Nekonymous does not protect against:

- Telegram or Worker plaintext access during normal processing;
- compromised bot token, Cloudflare account, Worker code, master key, or HMAC pepper;
- malicious recipients copying or publishing messages;
- endpoint malware or compromised Telegram accounts;
- legal/platform access to Telegram or Cloudflare data;
- traffic analysis by infrastructure providers;
- determined identity inference from writing style or content;
- coordinated abuse by many distinct accounts;
- perfect anonymity or guaranteed safe conversation partners.
