# Sealed Ticketing

**Status:** canonical anonymous messaging and inbox protocol for the current `master` branch.

The protocol minimizes joinable stored data while preserving a usable Telegram inbox, anonymous replies, private nicknames, blocking, reporting, and bounded recovery from Queue or Telegram failures.

## Design goals

- independent capability per message;
- no plaintext anonymous message body in D1 or KV;
- no plaintext sender-recipient graph in D1;
- no recoverable per-user `ticketHash` index;
- recipient/account-bound ticket actions;
- temporary unread state with explicit leases and retention;
- payload clearing after successful delivery;
- blind, domain-separated relationship tags;
- idempotent creation, notification, delivery, and request acceptance;
- conservative failure semantics: temporary failures do not destroy healthy tickets.

## Capability format

`TicketCapability` is exactly 32 bytes:

```text
bytes 0..15   lookupNonce
bytes 16..31  keySeed
```

Canonical encoding:

```text
43 unpadded Base64URL characters
[A-Za-z0-9_-]{43}
```

The capability has one canonical encoding and no fit format.

Two creation modes exist:

- random material for ordinary messages and replies;
- deterministic HKDF material for retry-safe operations such as accepting a conversation request.

A deterministic capability uses the stable application master key and an operation-specific `dedupeKey`. The same operation derives the same capability and therefore the same `ticketHash` and unread dedupe tag.

## Ticket lookup and keys

`ticketHash` is derived only from `lookupNonce` with a domain-separated HMAC:

```text
HMAC(APP_HMAC_PEPPER,
     "nekonymous:ticket:lookup" || lookupNonce)
```

Database lookup therefore does not require or reveal `keySeed`.

Ticket encryption keys are derived from:

- stable `APP_MASTER_KEY` input key material;
- salt containing `ticketHash` and `keySeed`;
- domain-separated HKDF labels.

Independent AES-GCM keys protect:

- route capsule;
- payload capsule;
- metadata capsule.

Each capsule uses separate associated data bound to `ticketHash`. An encrypted capsule cannot be moved to another ticket or capsule domain without authentication failure.

## Owner proof

Ticket actions require both capability possession and the correct Telegram actor/current account.

The stored owner proof binds:

```text
recipient stable Telegram actor hash
+ recipient current internal account id
+ ticketHash
```

The Worker recomputes the proof and compares it in constant time before decrypting action material.

Hard reset creates a new internal account id. Old capabilities therefore fail authorization immediately even if their encrypted vault records have not yet expired.

## TicketVault record

TicketVault uses the blind `ticketHash` as its primary lookup key and stores:

```text
ticket_hash
owner_proof_tag
route_enc
payload_enc
meta_enc
status
created_at
expires_at
```

It does not store:

- raw capability;
- lookup nonce or key seed;
- Telegram user id or chat id in plaintext;
- direct sender or recipient account id;
- message transcript;
- conversation graph.

### Route capsule

The encrypted route capsule contains only action material required after delivery:

```text
senderChatRoute       encrypted Telegram chat route
replyRouteTag         sender stable Telegram actor hash
contactTag            recipient-scoped nickname key
blockTag              recipient-scoped stable block key
abuseSubjectTag       stable blind safety subject
replyPolicy           bounded reply rules
parentMessageId       minimal Telegram reply context
replyToMessageId      optional reply context
```

### Payload capsule

The payload capsule contains either:

- text plus minimal Telegram context; or
- a supported Telegram file identifier and caption context.

Payload ciphertext is temporary. After successful Telegram delivery, it is cleared and the ticket is marked viewed.

### Metadata capsule

Metadata contains non-routing display data such as the short ticket display number and creation time. It is encrypted separately.

## Blind relationship tags

All tags use HMAC with length-delimited fields and distinct domains.

### `contactTag`

```text
recipient current internal account id
+ sender current internal account id
```

Used as the primary key for the recipient's encrypted private nickname. Reset by either side changes the tag and ends nickname continuity.

### `blockTag`

```text
recipient current internal account id
+ sender stable Telegram actor hash
```

A sender hard reset does not bypass an existing recipient block. A recipient hard reset clears the recipient-local block list because the recipient account scope changes.

### `abuseSubjectTag`

```text
sender stable Telegram actor hash
```

Used to route to one SafetyState Durable Object. It survives ordinary sender account reset.

### `reportEventTag`

```text
ticketHash
+ reporter stable Telegram actor hash
```

Prevents the same reporter from counting the same ticket more than once.

### `reporterSubjectTag`

```text
abuseSubjectTag
+ reporter stable Telegram actor hash
```

Counts distinct reporters for one abuse subject without creating a reusable global reporter identity.

## Ticket creation

`createSealedTicket` performs the following durable sequence:

1. create random or deterministic capability material;
2. derive `ticketHash`;
3. derive owner proof and ticket keys;
4. derive contact, block, and abuse tags;
5. load Safety decision for the sender;
6. enforce recipient pause and block state;
7. construct bounded route, payload, and metadata capsules;
8. encrypt all three capsules;
9. store the TicketVault record;
10. initialize recipient UserState when necessary;
11. derive a blind unread dedupe tag;
12. generate a random unread item id;
13. seal the encoded capability for that recipient and unread item;
14. insert the unread row;
15. return the authoritative pending count and notification event id.

TicketVault storage returns either `created` or `existing`. Compensation deletes only a vault record created by the current invocation. A retry of a deterministic accept operation can never delete a healthy ticket created by an earlier attempt.

The durable acceptance point is successful vault storage plus accepted unread insertion. Notification and statistics run as deferred side effects.

## Unread storage

One recipient UserState row is created for each undelivered ticket:

```text
item_id                  random UUID
sealed_capability_enc    authenticated encrypted capability
dedupe_tag               blind ticket-specific dedupe value
delivery_state           active | delivering
delivery_attempt_id      random lease owner
delivery_lease_until     lease expiry
created_at
expires_at
```

UserState does not store the ticket hash, plaintext capability, message body, route capsule, or sender account id.

Limits:

```text
maximum active unread items: 50
maximum items attempted in one drain: 50
unread delivery lease: 60 seconds
```

Expired leases are recovered to `active`. Expired unread rows are removed in bounded batches.

## Notification events

Every newly inserted unread row returns one random notification event id.

```text
accepted unread
  → inbox-notification(accountId, eventId)
  → consumer reads current unread count
  → fresh Telegram message: X unread
  → callback ib:d
```

Notification properties:

- independent event per unread;
- stable idempotency key per account and event;
- count is not stored in the Queue job;
- count is read from UserState at send time;
- no capability, ticket hash, message body, route, or sender identity in the job;
- if live count is zero, the consumer sends nothing;
- no editable notification, message id registry, aggregate cycle, revision, or generation.

Multiple quick messages can therefore produce multiple notifications with the same latest count. This is intentional product behavior and does not group ticket authority.

## Inbox drain

The user starts a drain through `/inbox`, the main Inbox button, or `ib:d`.

The webhook only validates current state, enqueues a drain job, and immediately replies that messages are being opened. Actual delivery occurs through the Outbox Queue.

For each claimed unread item:

1. open the sealed capability in memory;
2. parse the canonical capability;
3. derive `ticketHash`;
4. load TicketVault;
5. verify owner proof for the current actor/current account;
6. derive keys and authenticate capsules;
7. load recipient block state and optional private nickname;
8. construct one TelegramOutbox job with `ticket-delivery:{ticketHash}` idempotency;
9. deliver through the recipient's per-chat TelegramOutbox Durable Object;
10. clear payload and mark the ticket viewed;
11. complete the matching unread attempt and delete the row.

Private nickname lookup is cached during one drain to avoid repeated storage reads for the same contact tag.

## Delivery failure semantics

### Retryable failures

The unread lease is released and the Queue message is retried when there is a temporary:

- Durable Object or D1 failure;
- Queue/consumer failure;
- unexpected crypto runtime or configuration error;
- Telegram network or 5xx failure;
- Telegram `429` response;
- active Outbox lock or pacing delay.

The drain result explicitly reports `retry`; it is never acknowledged as complete by mistake.

### Permanent orphan conditions

An unread item is completed as unavailable when the capability/ticket is explicitly:

- malformed in a clearly permanent way;
- missing;
- expired;
- already terminal without a payload;
- unsupported for delivery;
- permanently rejected by Telegram.

Orphan cleanup first completes the exact unread attempt. Only the attempt that still owns the row may delete the TicketVault record. This prevents an expired worker from deleting a ticket claimed by a newer worker.

Unknown exceptions are conservative: release and retry, not destructive cleanup.

## TelegramOutbox semantics

One TelegramOutbox Durable Object is addressed by chat hash.

It provides:

- stable idempotency records;
- per-chat send lock and lease;
- immediate first send;
- approximately one second between real sends;
- Telegram `retry_after` handling;
- five-second generic retry;
- permanent rejection classification;
- seven-day bounded event retention and alarm cleanup.

The Queue consumer creates independent sequential lanes per chat and processes different chats concurrently.

## Actions after delivery

The delivered Telegram message owns future ticket capability callbacks until ticket expiry.

### Reply

Reply action:

- verifies ticket ownership and reply policy;
- resolves the sender through the encrypted route tag;
- creates a bounded reply draft;
- the resulting reply calls `createSealedTicket` again;
- recipient block/pause and sender Safety checks are always re-evaluated.

A previous ticket never grants permanent permission to contact someone.

### Private nickname

Nickname state is stored in recipient UserState:

```text
contact_tag primary key
nickname_ciphertext
created_at
updated_at
```

The nickname is visible only to the recipient and is applied when future tickets with the same contact tag are delivered.

Nickname drafts have explicit expiry. All drafts have a default bounded TTL.

### Block and unblock

Blocking stores only `blockTag` in recipient UserState. The receive gate checks it before direct messages, replies, and conversation requests are accepted.

Block/unblock mutations are idempotent and aggregate statistics are emitted only on real state transitions.

### Report and Safety

A report derives `reportEventTag` and `reporterSubjectTag` and submits them to the SafetyState Durable Object addressed by `abuseSubjectTag`.

SafetyState stores:

```text
report event tag
reporter subject tag
reason code
created and expiry timestamps
singleton sanction state for this abuse subject
```

Allowed reason codes are runtime validated. Current public actions use `inbox_report`; internal policy also recognizes `spam`.

Policy:

- 5 distinct reporters within 24 hours → 72-hour suspension;
- suspension transitions to 30-day probation;
- 3 distinct reporters within 7 days during probation → indefinite ban;
- a later complete first-strike threshold after a prior strike may ban;
- event retention: 90 days.

## Retention

| Data | Retention/lifecycle |
|---|---|
| Ticket route/meta | up to 30 days, unless orphan cleanup removes earlier |
| Ticket payload | until successful delivery, permanent orphan cleanup, or 30-day expiry |
| Unread row | until delivery, orphan completion, reset, or ticket expiry |
| Outbox idempotency row | 7 days |
| Report event | 90 days |
| Private nickname/block | until recipient removes it or resets account |
| Draft | explicit expiry or 24-hour default |

Retention cleanup is bounded. No request path scans all vault records.

## Hard reset

Hard reset:

- invalidates profile/discovery state before rotating identity;
- attempts to remove unread ticket records;
- purges UserState, including unread rows, drafts, blocks, and nicknames;
- hard-deletes user and public links from D1;
- removes KV routing entries best effort;
- creates a new internal account and public link.

Old callbacks immediately fail owner proof because the internal account id changed. Sanctions use the stable abuse subject and are not cleared by ordinary account reset.

## Security limits

Sealed ticketing protects stored data from casual relational inspection and reduces joinable application state. It does not prevent Telegram or the Worker from seeing plaintext during normal processing, protect a compromised bot token or application key, prevent recipients from copying content, or provide perfect anonymity.

See [Threat Model](./threat-model.md).
