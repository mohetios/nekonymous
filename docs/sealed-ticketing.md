# Sealed Ticketing

**Status:** canonical specification for anonymous message routing and inbox behavior.

Sealed ticketing is the core Nekonymous relay model. Anonymous messages are not stored as normal sender-recipient rows. Each new message becomes a recipient-scoped capability backed by blind lookup keys and encrypted capsules.

## Design Goals

- Hide users from each other in normal product flows.
- Avoid a plaintext anonymous sender-recipient graph.
- Keep message payload storage temporary.
- Preserve reply, block, report, and nickname actions after first display.
- Keep Telegram callback data short and language-independent.
- Bound Worker CPU, storage reads, and decryptions.
- Make webhook, queue, callback, and cleanup retries idempotent.

This model does not hide plaintext from Telegram or the Worker while a message is processed.

## Ticket Model

```text
TicketCapability
  -> lookupNonce + keySeed
  -> ticketHash
  -> ownerProofTag
  -> route_enc
  -> payload_enc
  -> TicketVault
  -> unread UserState item
  -> inbox claim
  -> delivered Telegram message with action buttons
```

### `TicketCapability`

A 32-byte binary capability encoded with unpadded base64url:

```text
lookupNonce = 16 random bytes
keySeed = 16 random bytes
encoded length = 43 characters
```

Examples:

```text
o:{ticketCapability}
r:{ticketCapability}
b:{ticketCapability}
u:{ticketCapability}
n:{ticketCapability}
rp:{ticketCapability}
```

Rules:

- the raw value is not stored as a database key or recoverable inbox pointer;
- it contains no user ID, chat ID, locale, or message text;
- handlers validate exact length, canonical base64url encoding, and callback size before cryptographic work;
- possession is not sufficient: actor ownership must also be verified;
- after successful Telegram notification delivery, Telegram chat history is the persistent ticket index.

### `ticketHash`

A blind lookup key derived with a domain-separated HMAC:

```text
ticketHash = HMAC(K_TICKET_LOOKUP, "nekonymous:ticket:lookup" || lookupNonce)
```

TicketVault uses this hash for lookup and sharding. `keySeed` must not affect `ticketHash`.

### `ownerProofTag`

An actor-bound proof derived from the current actor and ticket:

```text
ownerProofTag = HMAC(
  K_OWNER_PROOF,
  "nekonymous:ticket:owner" || actorHash || currentInternalAccountId || ticketHash
)
```

The Worker recomputes the proof during a callback and compares it in constant time with the stored value. Hard account reset creates a new internal account id, so old capabilities fail owner proof immediately even though old ciphertext physically expires through the normal ticket lifecycle.

### Ticket Keys

Route, payload, and metadata keys require the capability `keySeed`:

```text
ticketRootKey = HKDF-SHA-256(
  ikm = APP_MASTER_KEY,
  salt = ticketHash || keySeed,
  info = "nekonymous:ticket:root"
)
```

Separate route, payload, and metadata keys are derived from that root. `APP_MASTER_KEY` plus `ticketHash` alone is intentionally insufficient to decrypt a ticket.

AAD values:

```text
nekonymous:ticket:{ticketHash}:route
nekonymous:ticket:{ticketHash}:payload
nekonymous:ticket:{ticketHash}:meta
```

## Capsules

`route_enc` is one compact AES-GCM envelope containing only the routing material required for anonymous reply, block, unblock, report, private nickname, action policy, and expiry checks.

`payload_enc` contains the message body and minimal payload metadata. It is encrypted at rest and exists only until the first successful Telegram delivery.

Route data is not duplicated into UserState, D1, KV, logs, or callback data.

## Storage Boundaries

| Plane | Stores | Does not store |
|---|---|---|
| D1 | users, public links, aggregate statistics | anonymous body, ticket route, sender-recipient message edge |
| TicketVault DO | blind ticket hash, owner proof, encrypted route, temporary encrypted payload, status and expiry | raw capability or plaintext capsule |
| UserState DO | unread item id, sealed capability ciphertext, blind dedupe tag, delivery lease metadata | message body, plaintext route, ticket hash, or raw capability |
| KV | optional routing/cache data | ticket, inbox, report, or message authority |
| ReportLedger DO | blind abuse and reporter tags | reversible sender-recipient relation |
| Telegram | callback capability and delivered message | application-controlled storage guarantees |

## Message Creation

```text
1. Resolve the recipient from the public deep link.
2. Validate sender state, recipient pause state, blocks, limits, and message length.
3. Claim the stable operation/dedupe identity.
4. Generate TicketCapability.
5. Derive ticketHash from lookupNonce and ownerProofTag from actor/account/ticketHash.
6. Build compact route and payload capsules.
7. Derive route/payload/meta keys from APP_MASTER_KEY, ticketHash, and keySeed.
8. Encrypt route, payload, and meta.
9. Store the TicketVault record.
10. Seal the encoded capability as authenticated ciphertext in a recipient unread item.
11. Queue one unread notice per newly accepted unread item (with live unread count).
12. Emit best-effort aggregate statistics.
```

If unread item creation fails after vault storage, compensation removes the orphaned ticket. Repeating the same operation must not create multiple durable tickets.

## Inbox Lifecycle

Maximum retention:

```text
30 days
```

### Unseen Ticket

```text
status: active
route_enc: present
payload_enc: present
```

The inbox claim flow:

1. claims an unread item from UserState;
2. decrypts the sealed capability in memory;
3. derives `ticketHash` from `lookupNonce` and loads TicketVault;
4. resolves the current Telegram actor and internal account id;
5. verifies owner proof and expiry;
6. derives keys from `keySeed` and decrypts route/payload;
7. sends the complete message through Telegram;
8. clears the payload only after Telegram confirms successful delivery;
9. marks the ticket viewed and deletes the unread row.

A failed Telegram send does not clear the payload.

### Viewed Ticket

```text
status: viewed / replied / reported / blocked
route_enc: present
payload_enc: absent
```

The original Telegram-delivered message remains the primary message view. Re-opening the direct button can render a compact shell without decrypting a payload. The shell can retain only actions allowed by the current state.

### Expired Ticket

After expiry:

```text
route_enc: removed
payload_enc: removed
meta_enc: removed
callback: unavailable
```

The TicketVault record is deleted, or only a bounded non-sensitive tombstone is retained when required for idempotency. Sensitive route and payload material never remains as an expired archive.

TicketVault alarms are bounded and idempotent because Durable Object alarms may run more than once.

## State Transitions

The exact state list is defined in code. The product transition policy is:

```text
active
  -> viewed
  -> replied / reported / blocked
  -> expired or deleted
```

Valid direct transitions can also occur from `active`, for example a block or report before a reply.

Rules:

- state does not regress;
- `expired` is terminal;
- repeated same-state operations return idempotent success;
- SQL compare-and-set conditions enforce the current state;
- a stale callback cannot overwrite a newer terminal action.

## Action Resolution

All ticket actions follow one resolver boundary:

```text
callback data
  -> validate action and parse capability
  -> derive actorHash and current internal account id
  -> derive ticketHash
  -> load TicketVault record
  -> constant-time owner-proof check
  -> reject expiry or illegal state
  -> derive route key from keySeed
  -> decrypt and validate route capsule
  -> execute action
```

`payload_enc` is not decrypted for reply, nickname, block, or normal report routing.

Decrypted capsules are runtime-validated. TypeScript types alone are not accepted as validation.

## Replies

A reply uses the route capsule to create another sealed ticket for the other participant. It follows the same creation, payload, direct-open delivery, and expiry rules as the original message. The parent capability is not reused.

The bot does not create a persistent conversation transcript.

## Block And Private Nickname

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

### Telegram Webhook

Telegram updates use a sharded two-phase processed-event claim:

```text
new
  -> processing with lease
  -> done
```

A duplicate completed update returns safely. A duplicate update observed while the original claim is still `processing` returns a retryable non-2xx response, so Telegram can retry if the original execution crashes before completion. A crashed processing lease can be reclaimed after expiry.

### Ticket Creation

Stable operation keys prevent a retried webhook or accepted conversation request from creating duplicate tickets.

### Telegram Outbox

Outbox delivery uses:

```text
idempotency key
  -> atomic lease claim
  -> Telegram call
  -> lease-guarded finalize
```

A duplicate with a valid active lease does not call Telegram. A stale lease owner cannot overwrite a newer attempt.

Unread notices are ordinary Telegram outbox jobs. They carry no capability, ticket hash, unread count authority, or message plaintext. The inbox control card reloads authoritative state from UserState.

After Telegram confirms success, the queue message is acknowledged and the Durable Object retains only bounded delivery metadata. If Telegram delivery fails, the encrypted capability remains in the queue message for retry; no raw capability is logged or stored in durable outbox state.

## Cryptographic Boundaries

Primitive operations use Web Crypto:

- HMAC for blind lookups and proofs;
- HKDF for domain-separated derived keys;
- AES-GCM for route, payload, profile, and request envelopes;
- cryptographically secure random bytes for capability material.

Rules:

- use explicit HKDF domain strings;
- do not reuse stable actor tags across storage planes;
- do not log keys, plaintext capsules, ciphertext envelopes, raw capabilities, callback data, or Telegram IDs;
- use compact envelopes with version and key identifier fields;
- validate supported envelope versions before decryption or use.

This design reduces stored joinability. It does not protect data if application secrets or the running Worker are compromised.

## Logging

Allowed operational fields:

- high-level status names;
- bounded counts;
- generic action names;
- non-sensitive queue and alarm states.

Forbidden operational fields:

- Telegram user IDs or chat IDs;
- raw ticket capabilities;
- message bodies;
- decrypted route or payload capsules;
- app secrets or derived key material.
