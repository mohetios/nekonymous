# Ticketing

Nekonymous anonymous delivery is a sealed-ticket protocol:

```text
TicketCapability -> lookupNonce + keySeed -> ticketHash
                 -> ownerProof -> encrypted route/payload
                 -> TicketVault + blind UserState slot
                 -> Telegram open button -> actions -> expiry
```

- `TicketCapability` is a 43-character unpadded base64url capability shown only in Telegram callback data.
- `ticketHash` is the vault lookup key derived only from the capability lookup nonce.
- `keySeed` is required with `APP_MASTER_KEY` to decrypt route, payload, and meta capsules.
- `ownerProof` binds the ticket to the recipient actor and current internal account id before actions run.
- `route_enc` keeps encrypted reply/block/report routing until ticket expiry.
- `payload_enc` is temporary and is cleared after successful Telegram delivery.
- `TicketVaultDO` stores encrypted ticket material; `UserStateDO` stores blind slot tags only.
- Inline actions must resolve the ticket, verify ownership, decrypt route material, and then apply policy.

This feature owns anonymous message sealing, direct ticket opening, ticket actions, payload validation, contact labels, and ticket lifecycle policy. It must not store plaintext message bodies or raw callback capabilities in D1, KV, or Durable Object storage.
