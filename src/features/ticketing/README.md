# Ticketing

This directory owns the sealed anonymous-message protocol and its Telegram inbox/actions.

Canonical specification: [`docs/sealed-ticketing.md`](../../../docs/sealed-ticketing.md).

## Core model

```text
TicketCapability
  → 16-byte lookupNonce + 16-byte keySeed
  → 43-character unpadded Base64URL
  → blind ticketHash from lookupNonce
  → actor/account-bound owner proof
  → independently encrypted route, payload, and metadata
  → TicketVault record
  → recipient UserState sealed unread capability
  → per-unread notification event
  → inbox drain and TelegramOutbox delivery
  → payload clear + unread completion
  → capability actions until 30-day expiry
```

## File ownership

| Area | Files |
|---|---|
| capability encoding and deterministic retry material | `ticket-capability.ts` |
| HMAC/HKDF/AES-GCM and AAD domains | `keys.ts`, `hmac.ts`, `hkdf.ts`, `aes-gcm.ts`, `envelope.ts` |
| blind contact/block/report tags | `blind-tags.ts` |
| ticket creation and compensation | `create-sealed-ticket.ts` |
| unread capability sealing | `unread-capability.ts` |
| inbox claim/drain/delivery/orphan handling | `inbox.ts` |
| notification Queue enqueue | `inbox-notification.ts` |
| callback resolution and ownership verification | `resolve-ticket-action.ts`, `service.ts` |
| reply/block/unblock/nickname/report handlers | `actions.ts` |
| message/deep-link handlers | `handlers.ts` |
| lifecycle and limits | `ticket-lifecycle.ts`, `../../contracts/inbox/constants.ts` |
| Telegram payload validation/normalization | `payload.ts` |

## Non-negotiable invariants

- TicketVault never stores the raw capability.
- UserState unread never stores ticket hash, message body, route, or sender account id.
- notification Queue jobs contain account/event only and read live count at send time.
- every accepted message creates an independent ticket and notification event.
- `/inbox` and `ib:d` drain current actor state; no inbox list or pagination.
- temporary failures release/retry; unknown errors are not destructive.
- orphan cleanup must own the exact unread attempt before deleting TicketVault.
- Outbox delivery uses `ticket-delivery:{ticketHash}` idempotency.
- block/pause/Safety gates run for direct message, reply, and accepted request delivery.
- blind tags remain domain separated.
- payload is cleared only after successful Telegram send.
- route/meta actions expire after 30 days.
- no plaintext anonymous transcript or peer graph in D1 or KV.
