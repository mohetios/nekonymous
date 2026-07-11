# Security Policy

## Supported version

| Version | Status |
|---------|--------|
| `master` (Conversation Suggestions V2, pre-release `pre-release-conversation-v2-acca6b9`) | Supported — security reports accepted |

Older experimental branches and pre-V2 assessment/matching code paths are not supported.

## Reporting a vulnerability

**Do not** open public GitHub issues for security vulnerabilities.

Email: [hi@mohetios.dev](mailto:hi@mohetios.dev)

Include:

- affected area or file path
- reproduction steps if available
- expected impact
- whether secrets, Telegram identities, message payloads, D1, Durable Objects, KV, Vectorize, or deployment credentials may be involved

## Privacy and security boundaries

Nekonymous is a **hosted anonymous Telegram relay**. It is:

- **Not** end-to-end encrypted (E2EE)
- **Not** zero-knowledge
- **Not** a perfect anonymity system

**By design:**

- Telegram sees messages while users send and receive through Telegram.
- The Worker sees plaintext while processing delivery, encryption, and decryption.
- Stored sensitive data is encrypted at rest **where implemented** (payloads, chat ids, route capsules, profiles, request intros).
- Raw Telegram user ids are not stored in D1, KV, or Vectorize metadata.

For the full threat model, see [docs/security/threat-model.md](./docs/security/threat-model.md).

## What not to report as a vulnerability

The following are **documented product boundaries**, not defects:

- Telegram visibility of messages in transit
- Worker plaintext processing during relay
- Absence of E2EE or zero-knowledge guarantees
- Documented rate limits, inbox caps, and cooldowns
- Recipient ability to screenshot or forward messages
- Approximate (non-clinical) conversation suggestions

## Sensitive data handling

| Data | Storage |
|------|---------|
| Anonymous message bodies | TicketVault DO encrypted; payload cleared after inbox delivery |
| Sender–recipient graph (relay) | Not stored in D1 as plaintext edges |
| Telegram user id | HMAC hash in D1 |
| Telegram chat id | AES ciphertext in D1 |
| Callback ticket refs | Short refs in Telegram only; blind hashes / sealed pointers in storage |
| Profile questionnaire session | Encrypted session in UserState DO; raw answers deleted after finalization |
| Finalized conversation profile | ProfileVaultShard DO encrypted; not in D1 |
| Request intro text | ConversationVaultShard DO encrypted |
| Reports | Blind tags in ReportLedger DO |

Details: [docs/security/threat-model.md](./docs/security/threat-model.md) and [docs/architecture/sealed-ticket-routing-and-inbox.md](./docs/architecture/sealed-ticket-routing-and-inbox.md).

## Known limitations

- Endpoint, secret, or Cloudflare/Telegram platform compromise is out of scope for application-layer guarantees.
- Conversation suggestions are product-level signals, not safety or identity guarantees.
- No payment flow; Telegram Stars are not implemented.

## Response expectations

This is an independent open-source project. Reports are reviewed as soon as practical; no formal SLA is provided.
