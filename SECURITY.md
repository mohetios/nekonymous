# Security Policy

## Supported versions

| Version | Status |
|---|---|
| current `master` | security reports accepted |
| older experimental, pre-current, and removed storage branches | unsupported |

## Reporting a vulnerability

Do **not** open a public issue for a suspected security or privacy vulnerability.

Email: [hi@mohetios.dev](mailto:hi@mohetios.dev)

Include:

- affected component or file path;
- reproduction steps or a minimal proof of concept;
- expected impact;
- whether Telegram identity, message content, callback capability, cryptographic material, D1, Durable Objects, KV, Queue, Vectorize, or deployment credentials are involved;
- whether the report contains real user data.

Do not send production message bodies, raw Telegram identifiers, bot tokens, ticket capabilities, encryption keys, HMAC peppers, ciphertext dumps, or Cloudflare credentials unless strictly necessary. Redact them whenever possible.

This is an independent open-source project. Reports are reviewed as soon as practical; no formal SLA or bounty is promised.

## Security boundary

Nekonymous is a hosted anonymous Telegram relay with encryption at rest and capability-gated actions.

It is **not**:

- end-to-end encrypted;
- zero-knowledge;
- a perfect-anonymity system.

Telegram sees message plaintext while users send and receive it. The Worker sees plaintext while processing, encrypting, decrypting, and delivering it.

Before inbox delivery, the recipient UserState stores an encrypted ticket capability. After delivery, Telegram callback data carries the capability for ticket actions. Capability possession is combined with an owner proof bound to the current Telegram actor and current internal account.

D1 does not store anonymous message bodies, ticket capabilities, finalized conversation profiles, request intros, or a plaintext anonymous relationship graph.

Read the complete [Threat Model](./docs/threat-model.md).

## Documented limitations

The following are expected boundaries, not vulnerabilities by themselves:

- Telegram can see messages sent through Telegram;
- the Worker processes plaintext;
- recipients can copy, screenshot, forward, or publish messages;
- infrastructure timing and row-count metadata exist;
- rate limits, inbox caps, expiry, pacing, cooldowns, and automated sanction thresholds are intentional;
- conversation suggestions are approximate product signals, not safety or fit guarantees;
- application guarantees do not survive compromise of the bot token, Worker code, Cloudflare account, `APP_MASTER_KEY`, or `APP_HMAC_PEPPER`.

A documented limitation is reportable when the implementation exposes more data than documented, bypasses an intended authorization/policy check, or destroys/duplicates data contrary to the documented state machine.

## High-value report areas

Reports are especially useful for:

- webhook secret bypass;
- capability guessing, non-canonical parsing, ownership bypass, or cross-account callback use;
- unread Queue access by the wrong actor;
- transient failures deleting healthy TicketVault or unread state;
- stale delivery attempts deleting a newer claim's ticket;
- duplicate Telegram delivery despite idempotency;
- duplicate deterministic ticket creation during request accept;
- payload clearing before successful delivery;
- expired/terminal route material remaining usable;
- block bypass through reply, reset, or conversation requests;
- Safety threshold, distinct-reporter, phase-window, or reset bypass;
- raw Telegram identity, content, capability, tag, or secret leaking into D1, KV, Vectorize, Queue payloads, or logs;
- cross-user Durable Object state access;
- stale profile-index work restoring reset/deleted discovery state;
- committed or logged credentials.

## Safe disclosure

Please allow time to investigate and prepare a fix before public disclosure. After remediation, a security advisory or release note may credit the reporter unless anonymity is requested.
