# Ticketing

Nekonymous anonymous delivery is a sealed-ticket protocol:

```text
ticketRef -> ticketHash -> ownerProof -> encrypted route
          -> temporary encrypted payload -> TicketVault
          -> UserState inbox pointer -> Telegram actions -> expiry
```

- `ticketRef` is the short raw capability shown only in Telegram callback data.
- `ticketHash` is the vault lookup key derived from the ref with HMAC.
- `ownerProof` binds the ticket to the recipient actor before actions run.
- `route_enc` keeps encrypted reply/block/report routing until ticket expiry.
- `payload_enc` is temporary and is cleared after inbox delivery.
- `TicketVaultDO` stores encrypted ticket material; `UserStateDO` stores inbox pointers only.
- Inline actions must resolve the ticket, verify ownership, decrypt route material, and then apply policy.

This feature owns anonymous message sealing, inbox delivery, ticket actions, payload validation, contact labels, and ticket lifecycle policy. It must not store plaintext message bodies or raw callback capabilities in D1, KV, or Durable Object storage.
