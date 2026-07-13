# Security Policy

## Supported version

| Version | Status |
|---|---|
| current `master` | security reports accepted |
| older experimental and pre-V2 branches | unsupported |

## Reporting a vulnerability

Do **not** open a public GitHub issue for a suspected vulnerability.

Email: [hi@mohetios.dev](mailto:hi@mohetios.dev)

Include:

- affected component or file path;
- reproduction steps or a minimal proof of concept;
- expected impact;
- whether Telegram identities, messages, callbacks, secrets, D1, Durable Objects, KV, Queues, Vectorize, or deployment credentials are involved;
- whether the report contains real user data.

Do not send production message bodies, raw Telegram IDs, bot tokens, callback capabilities, or Cloudflare credentials unless they are necessary to understand the issue. Redact them whenever possible.

This is an independent open-source project. Reports are reviewed as soon as practical; no formal response SLA is provided.

## Product security boundary

Nekonymous is a hosted anonymous Telegram relay.

It is not:

- end-to-end encrypted;
- zero-knowledge;
- a perfect-anonymity system.

Telegram sees message plaintext while users send and receive messages. The Worker sees plaintext while processing, encrypting, decrypting, and delivering messages.

Sensitive stored data is encrypted at rest where implemented. Raw Telegram user IDs are not stored in D1, KV, or Vectorize metadata. Anonymous message bodies and routes are not stored as plaintext D1 rows.

Telegram chat history holds the ticket capability after notification delivery. Nekonymous stores encrypted ticket material but does not retain a recoverable per-user ticket index. Possession of the capability and the correct Telegram actor are both required for ticket actions.

Deleting the Telegram notification or chat history can permanently remove the user's ability to access that ticket. Telegram and the Worker still see plaintext while processing. This is not E2EE, zero-knowledge, or perfect anonymity.

Read the full [Threat Model](./docs/threat-model.md).

## Documented limitations, not vulnerabilities

The following are expected product boundaries:

- Telegram can see messages in transit;
- the Worker processes plaintext;
- recipients can screenshot, forward, or copy messages;
- rate limits, inbox caps, cooldowns, and expirations are intentional;
- conversation suggestions are approximate product signals, not identity, safety, or psychological guarantees;
- Nekonymous does not implement payments or Telegram Stars;
- application-layer guarantees do not survive bot-token, Worker, Cloudflare-account, or application-key compromise.

A documented limitation can still be reported when the implementation behaves more weakly than the documentation, leaks additional data, or bypasses an intended control.

## High-value report areas

Reports are especially useful for:

- forged webhook acceptance;
- capability guessing, ownership bypass, or callback replay;
- duplicate ticket or request creation;
- payload clearing before successful delivery;
- expired route material remaining accessible;
- raw Telegram identity or message content leaking into D1, KV, Vectorize, queues, or logs;
- cross-user Durable Object state access;
- stale profile-index work restoring deleted discovery data;
- outbox lease or idempotency bypass;
- block/report bypass;
- secret exposure in repository, build output, or CI logs.

## Safe disclosure

Please allow time to investigate and prepare a fix before public disclosure. After remediation, a security advisory or release note may credit the reporter unless anonymity is requested.
