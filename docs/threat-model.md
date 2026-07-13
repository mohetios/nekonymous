# Threat Model

**Scope:** current Nekonymous `master` — a Persian-first, Telegram-bot-only hosted anonymous relay on Cloudflare.

This document describes application-level guarantees and limitations. It does not extend the guarantees of Telegram, Cloudflare, user devices, networks, or operators.

## Security summary

Nekonymous hides users from each other in normal product flows, minimizes joinable stored data, and encrypts sensitive stored data at rest where implemented.

It does not provide:

- end-to-end encryption;
- zero-knowledge processing;
- perfect anonymity or untraceability;
- protection from a compromised Telegram account or device;
- protection from a compromised Worker, deployment account, or application secret;
- identity verification or safety guarantees for conversation suggestions.

Telegram and the Worker see plaintext while processing messages.

## Protected assets

- Telegram bot token and webhook secret
- application master key and HMAC pepper
- Telegram user and chat identities
- anonymous message payloads
- encrypted ticket routes
- ticket capabilities, blind slots, and local labels
- finalized conversation profiles
- request intros and suggestion/request capabilities
- pair state and abuse reports
- Cloudflare account, bindings, queues, and deployment credentials

## Actors

| Actor | Capability |
|---|---|
| anonymous sender | opens a deep link, submits messages, may spam or probe limits |
| recipient | reads inbox, replies, blocks, reports, labels routes |
| suggestion participant | builds a profile, enables discovery, sends or receives requests |
| Telegram | transports updates and messages and sees plaintext |
| Worker/runtime operator | processes plaintext and controls deployment secrets |
| storage attacker | obtains exports from D1, Durable Objects, KV, Vectorize, or queues |
| external attacker | forges webhooks, steals secrets, probes callbacks or public links |
| compromised user device | reads Telegram history, screenshots, forwards content |
| abusive user | harasses, floods, evades social expectations, or misuses suggestions |

## Trust boundaries

```text
User device
  ↔ Telegram
  ↔ public network
  ↔ Cloudflare Worker
  ↔ D1 / Durable Objects / KV / Queues / Vectorize
  ↔ Telegram
  ↔ recipient device
```

Plaintext exists at the user device, Telegram, and Worker processing boundary.

Application-layer encryption primarily protects stored exports and accidental cross-plane disclosure. It does not protect against a malicious or compromised running Worker with access to keys.

## Data inventory

| Data | Storage |
|---|---|
| Telegram user ID | HMAC-derived identity in D1; raw value not stored there |
| Telegram chat ID | encrypted at rest where required for delivery |
| public link slug | D1 and routing cache |
| anonymous message body | encrypted TicketVault payload; cleared after successful Telegram delivery |
| anonymous route | encrypted TicketVault route; removed at expiry |
| ticket capability | Telegram callback button after notification delivery; encrypted queue payload until delivery succeeds |
| inbox entry | blind UserState slot |
| private nickname | recipient-local encrypted/local state |
| block state | blinded/local route state |
| report | blind tags and structured reason in ReportLedger |
| raw profile answers | encrypted active session; deleted after profile finalization |
| finalized profile | encrypted ProfileVault record |
| suggestion/request intro | encrypted ConversationVault record |
| candidate retrieval vector | controlled 8-dimensional Vectorize value |
| aggregate statistics | D1 daily counters; optional short-lived KV cache |

D1 does not store anonymous message bodies, finalized profiles, request intros, or a plaintext anonymous social graph.

Vectorize does not receive Telegram IDs, display names, answers, or message text.

## Main threats and controls

### Forged Telegram webhook

**Threat:** an attacker sends fake updates to `POST /bot`.

**Controls:**

- webhook secret validation;
- POST-only bot endpoint;
- strict update parsing;
- no general public API surface;
- stable webhook event idempotency.

**Residual risk:** theft of the webhook secret or deployment configuration bypasses this boundary.

### Duplicate or reordered updates

**Threat:** Telegram or infrastructure retries the same update, or concurrent callbacks race.

**Controls:**

- sharded processed-event claims with leases;
- stable operation keys;
- compare-and-set status transitions;
- idempotent ticket and request creation;
- generic handling for expired or already-completed callbacks.

### Callback capability guessing or replay

**Threat:** an attacker guesses a callback reference or reuses an old button.

**Controls:**

- cryptographically random base64url capabilities;
- blind HMAC lookup keys derived from lookup nonces;
- actor/account-bound owner proofs;
- decryption keys that require the capability keySeed;
- strict callback format and action validation;
- expiration and state checks;
- raw capabilities not stored in D1, KV, UserState, or TicketVault after successful notification delivery.

**Residual risk:** a capability visible on a compromised Telegram account can be replayed by that account until expiry and allowed-state checks reject it. Deleting the Telegram notification or chat history can permanently remove the user's ability to access that ticket.

### Storage export

**Threat:** D1, Durable Object, KV, queue, or Vectorize data is copied.

**Controls:**

- separate storage planes;
- encrypted route, payload, profile, and intro capsules;
- blind lookup and pair tags;
- no message body or relay graph in D1;
- no identity metadata in Vectorize;
- temporary payload and bounded route retention;
- encrypted ticket material is not decryptable from storage plus `APP_MASTER_KEY` without the Telegram-held capability keySeed;
- blind reports and aggregate statistics.

**Residual risk:** ciphertext, timing, counts, status, and coarse vectors can still provide metadata. Compromise of application encryption keys can expose non-ticket encrypted records; ticket payloads and routes also require the corresponding ticket capability.

### Worker or secret compromise

**Threat:** an attacker controls the deployed Worker or obtains bot/application secrets.

**Impact:**

- plaintext can be observed during processing;
- encrypted stored data may become decryptable;
- identities and routes may be correlated;
- Telegram messages may be forged.

**Controls:**

- secrets stored through Cloudflare secret configuration;
- no secrets in repository examples;
- minimal logging;
- direct bindings rather than public service credentials;
- least-necessary data retention;
- automated repository checks.

This is a high-impact residual risk. Nekonymous does not claim protection from the runtime operator.

### Anonymous message abuse

**Threat:** flooding, harassment, repeated links, or bypass attempts.

**Controls:**

- global action throttling;
- inbox caps and bounded rendering;
- message length limits;
- pause/resume;
- route block and unblock;
- reports with blind abuse tags;
- ticket expiry;
- idempotent creation and notification.

**Residual risk:** a determined user can create new Telegram accounts or use out-of-band information. The system is not an identity-proof or anti-abuse guarantee.

### Conversation suggestion misuse

**Threat:** users interpret suggestions as psychological truth, identity proof, safety, or compatibility.

**Controls:**

- direct non-clinical questions;
- no demographic inference;
- opt-in discoverability;
- deterministic documented ranking;
- no public compatibility percentage;
- sealed suggestions and requests;
- accept/decline control;
- pair blocks, cooldowns, and exposure limits.

**Residual risk:** users can misrepresent themselves. Similar conversation preferences do not establish trust or safety.

### Telegram outbox duplication

**Threat:** queue at-least-once delivery or Durable Object interleaving sends duplicate Telegram messages.

**Controls:**

- stable idempotency keys;
- atomic delivery leases;
- lease expiry and reclaim;
- lease-guarded completion;
- per-chat ordering;
- bounded cross-chat concurrency;
- bounded sent/failure retention.

### Logs expose sensitive context

**Threat:** errors serialize Telegram objects, callback data, text, routes, or responses.

**Controls:**

- production-safe error serializer;
- stable error codes;
- no arbitrary request/error object logging;
- verification script for forbidden log patterns.

## Retention and deletion

### Message tickets

- payload: until first successful Telegram delivery, or ticket expiry;
- route: until ticket expiry;
- blind slot: until successful open, terminal invalidation, or ticket expiry;
- raw capability: not retained by Nekonymous storage after successful notification delivery;
- expired/evicted ticket: sensitive route, payload, and metadata removed;
- outbox idempotency records: bounded operational retention.

### Profiles and requests

- active raw answers: deleted after profile finalization;
- profile: retained while account/profile exists;
- Vectorize entry: deleted on profile removal, discoverability changes when required, or account reset;
- suggestion/request capabilities: bounded by status and expiry;
- pair and report state: bounded according to abuse/cooldown policy.

### Aggregate statistics

Anonymous aggregate counters may survive account reset because they do not contain account-linked records or message content.

## Hard reset

Hard reset creates a new internal identity and public link after attempting to revoke the old account across storage planes.

Current reset behavior covers:

- public link and D1 identity;
- UserState data and blind ticket slots;
- profile vault state;
- known Vectorize routes;
- suggestion/request capabilities;
- new identity and link creation;
- rejection of stale profile-index work.

Ticket access revocation is immediate because old callbacks no longer satisfy the owner proof after the internal account id changes. Physical ciphertext removal is bounded by the existing ticket expiry lifecycle; reset does not require a replacement user-to-ticketHash registry.

Known migration limitation:

Some profile records created before the July 2026 hardening did not persist their Vectorize identifiers in the encrypted profile route. Automated reset is complete for profiles indexed after that change. Older records without the route can require operator cleanup. This limitation must remain documented until historical data is migrated or removed.

Hard reset does not remove:

- messages already delivered into Telegram chat history;
- screenshots or forwarded copies;
- Telegram-side data;
- anonymous aggregate statistics;
- external backups outside application control.

## Key management limitations

The repository defines key derivation and envelope versioning but does not provide a universal transparent key-rotation system for all existing encrypted records.

Operational rules:

- never reuse development secrets in production;
- keep master and HMAC secrets independent;
- rotate the Telegram token and webhook secret after suspected exposure;
- treat master-key or HMAC-pepper exposure as a security incident;
- document any migration/re-encryption procedure before rotating data-encryption keys.

## Security claims

Acceptable:

> Nekonymous is a hosted anonymous Telegram relay with encrypted-at-rest storage boundaries, data minimization, sealed capabilities, and explicit privacy limitations.

Not acceptable:

```text
end-to-end encrypted
zero-knowledge
Telegram cannot see messages
the Worker cannot see messages
perfect anonymity
fully private
secure messenger
safe match
verified compatibility
```

## Reporting

Report suspected vulnerabilities privately using [`SECURITY.md`](../SECURITY.md). Do not include real message contents, Telegram identities, bot tokens, callback references, or production secrets in public issues.
