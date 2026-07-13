# Sealed Ticketing

**Status:** canonical specification for anonymous message routing and inbox behavior.

Sealed ticketing is the core Nekonymous relay model. Anonymous messages are not stored as normal sender-recipient rows. Each message becomes a recipient-scoped capability backed by blind lookup keys and encrypted capsules.

## Design goals

- Hide users from each other in normal product flows.
- Avoid a plaintext anonymous sender-recipient graph.
- Keep message payload storage temporary.
- Preserve reply, block, report, and nickname actions after first display.
- Keep Telegram callback data short and language-independent.
- Bound Worker CPU, storage reads, and decryptions.
- Make webhook, queue, callback, and cleanup retries idempotent.

This model does not hide plaintext from Telegram or the Worker while a message is processed.

## Ticket model

```text
ticketRef
  → ticketHash
  → ownerProofTag
  → route_enc
  → payload_enc
  → TicketVault
  → sealed inbox pointer
```

### `ticketRef`

A random base64url capability reference placed in Telegram callback data.

Examples:

```text
r:{ticketRef}
b:{ticketRef}
u:{ticketRef}
n:{ticketRef}
rp:{ticketRef}
```

Rules:

- the raw value is not stored as a database key;
- it contains no user ID, chat ID, locale, or message text;
- handlers validate length and character set before cryptographic work;
- possession is not sufficient: actor ownership must also be verified.

### `ticketHash`

A blind lookup key derived with a domain-separated HMAC:

```text
ticketHash = HMAC(K_TICKET_LOOKUP, ticketRef)
```

TicketVault uses this hash for lookup and sharding.

### `ownerProofTag`

An actor-bound proof derived from the current actor and ticket:

```text
ownerProofTag = HMAC(K_OWNER_PROOF, actorHash || ticketHash)
```

The Worker recomputes the proof during a callback or inbox operation and compares it in constant time with the stored value.

### Route capsule

`route_enc` is one compact AES-GCM envelope containing only the routing material required for:

- anonymous reply;
- block and unblock;
- report;
- private nickname;
- action policy and expiry checks.

It is encrypted with a per-ticket key derived through HKDF. Route data is not duplicated into inbox pointers, D1, KV, logs, or callback data.

### Payload capsule

`payload_enc` contains the message body and minimal payload metadata.

For the current release:

```ts
type PayloadCapsule = {
  type: "text";
  text: string;
  createdAt: number;
};
```

The payload is encrypted at rest and exists only until the first successful inbox delivery.

## Storage boundaries

| Plane | Stores | Does not store |
|---|---|---|
| D1 | users, public links, aggregate statistics | anonymous body, ticket route, sender-recipient message edge |
| TicketVault DO | blind ticket hash, owner proof, encrypted route, temporary encrypted payload, status and expiry | raw ticket reference or plaintext capsule |
| UserState DO | sealed inbox pointer, display reference, local status and expiry | message body or plaintext route |
| KV | optional routing/cache data | ticket, inbox, report, or message authority |
| ReportLedger DO | blind abuse and reporter tags | reversible sender-recipient relation |
| Telegram | callback capability and delivered message | application-controlled storage guarantees |

## Message creation

```text
1. Resolve the recipient from the public deep link.
2. Validate sender state, recipient pause state, blocks, limits, and message length.
3. Claim the stable operation/dedupe identity.
4. Generate ticketRef.
5. Derive ticketHash and ownerProofTag.
6. Build compact route and payload capsules.
7. Derive per-ticket encryption key.
8. Encrypt route and payload.
9. Store the TicketVault record.
10. Store a sealed inbox pointer in recipient UserState.
11. Notify the recipient without including message content.
12. Emit best-effort aggregate statistics.
```

If pointer creation fails after vault storage, compensation or later cleanup removes the orphaned ticket. Repeating the same operation must not create multiple durable tickets.

## Inbox lifecycle

Maximum retention:

```text
30 days
```

Maximum unseen payload decryptions per inbox request:

```text
10
```

### Unseen ticket

```text
status: active
route_enc: present
payload_enc: present
```

The inbox:

1. opens and verifies the sealed pointer;
2. resolves the ticket;
3. verifies owner proof and expiry;
4. decrypts the payload;
5. sends the complete message through Telegram;
6. clears the payload only after Telegram confirms successful delivery;
7. marks the ticket and pointer viewed.

A failed Telegram send does not clear the payload.

### Viewed ticket

```text
status: viewed / replied / reported / blocked
route_enc: present
payload_enc: absent
```

The inbox renders a compact shell without decrypting a payload. The shell can retain only actions allowed by the current state.

Example:

```text
پیام #NQ-7KFP قبلاً نمایش داده شده است.
```

The message body remains visible only in the Telegram message that originally delivered it.

### Expired or evicted ticket

After expiry or pointer eviction:

```text
route_enc: removed
payload_enc: removed
meta_enc: removed
callback: unavailable
```

The TicketVault record is deleted, or only a bounded non-sensitive tombstone is retained when required for idempotency. Sensitive route and payload material never remains as an expired archive.

TicketVault alarms and opportunistic pointer cleanup are bounded and idempotent because Durable Object alarms may run more than once.

## State transitions

The exact state list is defined in code. The product transition policy is:

```text
active
  → viewed
  → replied / reported / blocked
  → expired or deleted
```

Valid direct transitions can also occur from `active`, for example a block or report before a reply.

Rules:

- state does not regress;
- `expired` is terminal;
- repeated same-state operations return idempotent success;
- SQL compare-and-set conditions enforce the current state;
- a stale callback cannot overwrite a newer terminal action.

Examples of forbidden regressions:

```text
reported → viewed
blocked  → replied
expired  → active
```

## Action resolution

All ticket actions follow one resolver boundary:

```text
callback data
  → validate action and ticketRef
  → derive actorHash
  → derive ticketHash
  → load TicketVault record
  → constant-time owner-proof check
  → reject expiry or illegal state
  → derive ticket key
  → decrypt and validate route capsule
  → execute action
```

`payload_enc` is not decrypted for reply, nickname, block, or normal report routing.

Decrypted capsules are runtime-validated. TypeScript types alone are not accepted as validation.

## Replies

A reply uses the route capsule to create another sealed ticket for the other participant. It follows the same creation, payload, inbox, delivery, and expiry rules as the original message.

The bot does not create a persistent conversation transcript.

## Block and private nickname

Block state and private nicknames are recipient-local.

- Blocking prevents the same blinded route from creating new messages.
- A private nickname is not visible to the sender.
- Neither feature requires a plaintext sender identity in D1.
- Limits remain bounded to prevent unbounded UserState growth.

## Reports

Reports use blind, domain-separated tags derived from encrypted route seeds:

```text
senderAbuseTag
pairAbuseTag
linkAbuseTag
reporterProofTag
evidenceTag
```

The evidence tag is derived in the report domain; it is not a direct prefix of the TicketVault lookup hash.

ReportLedger stores structured abuse signals and reason codes, not message bodies or reversible user relations by default. Detailed report events have an explicit retention window and bounded cleanup. Long-lived aggregate abuse state, when present, remains blind.

## Idempotency

### Telegram webhook

Telegram updates use a sharded two-phase processed-event claim:

```text
new
  → processing with lease
  → done
```

A duplicate completed update returns safely. A duplicate update observed while the original claim is still `processing` returns a retryable non-2xx response, so Telegram can retry if the original execution crashes before completion. A crashed processing lease can be reclaimed after expiry.

### Ticket creation

Stable operation keys prevent a retried webhook or accepted conversation request from creating duplicate tickets.

### Telegram outbox

Outbox delivery uses:

```text
idempotency key
  → atomic lease claim
  → Telegram call
  → lease-guarded finalize
```

A duplicate with a valid active lease does not call Telegram. A stale lease owner cannot overwrite a newer attempt.

## Cryptographic boundaries

Primitive operations use Web Crypto:

- HMAC for blind lookups and proofs;
- HKDF for domain-separated derived keys;
- AES-GCM for route, payload, profile, and request envelopes;
- cryptographically secure random bytes for capability references.

Rules:

- use explicit HKDF domain strings;
- do not reuse stable actor tags across storage planes;
- do not log keys, plaintext capsules, ciphertext envelopes, callback references, or Telegram IDs;
- use compact envelopes with version and key identifier fields;
- validate supported envelope versions before decryption or use.

This design reduces stored joinability. It does not protect data if application secrets or the running Worker are compromised.

## Logging

Allowed operational fields:

```text
operation
safe status
stable error code
retryable flag
bounded hash prefix where explicitly permitted
```

Never log:

```text
ticketRef
Telegram user or chat ID
message text
decrypted route
decrypted payload
full callback data
bot token
request body
full Telegram response
```

## Source map

The current implementation is primarily in:

```text
src/features/ticketing/
src/storage/ticket-vault/
src/storage/user-state-do.ts
src/storage/user-state-client.ts
src/storage/report-ledger/
src/storage/telegram-outbox-do.ts
src/bot/callback-data.ts
src/queues/outbox-consumer.ts
```

This feature directory forms the sealed-ticketing domain: cryptographic capability primitives, creation, inbox rendering, actions, and Telegram-facing flow.

## Verification

Relevant checks include:

```bash
pnpm test:ticketing
pnpm test:idempotency
pnpm test:bot-flow
pnpm test:conversation-requests
pnpm test:release-hardening
pnpm audit:ticket-storage
pnpm run check
```

The storage audit must fail if it detects raw ticket references, anonymous message bodies in D1, plaintext routes, user IDs in callback data, or other forbidden ticket storage patterns.
