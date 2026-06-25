# Nekonymous V1 Threat Model

Nekonymous V1 is a hosted anonymous Telegram relay.

It hides users from each other and avoids storing a plain anonymous message transcript. Stored message payloads and route metadata are encrypted at rest. Reply routing uses short-lived capabilities held in Telegram private chat buttons.

Telegram and the Worker runtime still process delivery metadata and plaintext while delivering messages, so Nekonymous is not E2EE or zero-knowledge.

## Protected

- Raw Telegram user ids are not stored in D1, KV, DO, or Vectorize metadata.
- Telegram chat ids are encrypted at rest.
- Anonymous message payloads are encrypted in UserStateDO and cleared after delivery.
- Raw callback capabilities are not stored; lookup hashes are stored instead.
- Matching embeddings use sanitized profile summaries, not raw answers.
- Vectorize metadata does not include raw answers, Telegram ids, chat ids, or display names.

## Not Protected

- Telegram can see messages sent through Telegram.
- The Worker runtime sees plaintext while processing delivery.
- Cloudflare platform services process encrypted storage and vector data as configured bindings.
- Matching is approximate and product-level; it is not a safety, clinical, or identity guarantee.

## D1 Leak Scenario

This section answers: **if an attacker exports D1 only, what can they learn?**

Assume the attacker does **not** have `APP_MASTER_KEY`, `APP_HMAC_PEPPER`, Durable Object storage, KV, Vectorize vectors, or Telegram access.

### They cannot directly read

| Asset | Reason |
|-------|--------|
| Raw Telegram user id | Stored as `users.telegram_user_hash` (HMAC with pepper) |
| Telegram chat id | Stored as `users.telegram_chat_ciphertext` (AES envelope) |
| Anonymous message bodies | Not stored in D1; inbox payloads live in `UserStateDO` |
| Match intro text | `match_requests.intro_ciphertext` is encrypted |
| Report free-text details | `reports.details_ciphertext` is encrypted when present |
| Telegram username / phone | Not stored in D1 |

### They can still read (plaintext in D1)

| Asset | What it reveals |
|-------|-----------------|
| Internal `user_id` | Opaque Nekonymous account handle |
| `public_links.slug` | Public deep-link token (shareable by design) |
| `locale`, `status`, timestamps | Basic account metadata |
| `assessment_profiles.dimension_scores_json` | 14 normalized conversation-style dimension scores |
| `assessment_answers` | Per-question Likert values (`1`–`5`), not free text |
| `assessment_profiles.profile_summary_text` | Controlled Persian summary used for embeddings |
| Opt-in matching edges | `match_requests`, `match_suggestions`, `match_events` link internal user ids |
| Match explanation copy | Persian product reasons in `explanation_json` |
| `platform_stats` | Anonymous lifetime counters only |

### If secrets are also leaked

| Added secret | Additional exposure |
|--------------|---------------------|
| `APP_MASTER_KEY` | Decrypt chat ids, match intros, report details, DO ciphertext |
| `APP_HMAC_PEPPER` | Link Telegram accounts to internal users via hash reversal attempts |

Even with secrets, **normal delivered inbox message bodies are not in D1**. Undelivered or uncleared payloads may still exist encrypted in `UserStateDO`.

### Bottom line

A stolen D1 dump is **not** a full chat log and **does not expose Telegram identities by itself**.

It **is** still sensitive product data: assessment signals, opt-in matching relationships (by internal id), and encrypted blobs that become readable if application secrets are also compromised.

Run `pnpm audit:d1` for a repeatable read-only check of the current D1 posture.

## D1 vs Vectorize: Why Both Exist

Matching uses **two different storage roles**. They are not duplicates of the same data.

```text
Assessment complete
  → structured scores + summary saved in D1 (source of truth)
  → sanitized summary embedded by Workers AI
  → vector upserted to Vectorize (discovery index)

Match search
  → Vectorize topK: "who might be semantically nearby?"
  → D1 load assessment_profiles for those user ids
  → deterministic TypeScript ranking (match-scoring.ts)
  → D1 writes match_suggestions / match_requests workflow state
```

### Vectorize stores

- One embedding per completed profile (`profile:{userId}:v1`)
- 1024 float dimensions from `@cf/baai/bge-m3`
- Small filter metadata: `locale`, `discoverable`, `matchEligible`, `profileVersion`, `userIdHash`, `updatedAtEpoch`

**Purpose:** fast candidate discovery only. Vectorize is not the system of record and cannot run matching workflow logic.

### D1 stores (matching-related)

| Table / field | Why it is in D1, not Vectorize |
|---------------|--------------------------------|
| `assessment_profiles.dimension_scores_json` | Final ranking uses explicit dimension math, not vector distance alone |
| `discoverable`, `safety_tier`, `primary_intent`, `profile_bucket` | Hard filters and product rules before/after vector search |
| `vector_id`, `vector_status` | Links profile row to Vectorize index; tracks indexing success/failure |
| `assessment_attempts`, `assessment_answers` | Assessment history and completion state |
| `profile_vector_index_events` | Indexing audit trail |
| `match_suggestions` | Shown results, scores, Persian explanations, dismiss state |
| `match_requests` | Pending/accepted/declined intro workflow + encrypted intro |
| `match_blocks`, `match_events` | Blocks, rate limits, search/request audit events |

**Purpose:** authoritative profile data, transactional matching workflow, deterministic scoring inputs, account reset, and D1 fallback when the vector index is sparse (`fetchD1FallbackProfiles`).

### Why not put everything in Vectorize?

Vectorize is the wrong tool for:

- accept/decline request state machines
- encrypted intro storage
- hard deletes on account reset
- SQL filters on safety tier, confidence, and freshness
- showing the user their own assessment result
- bounded fallback queries when the index has few discoverable profiles

### Deliberate overlap

The only intentional overlap is the **sanitized profile summary**:

- D1 keeps `profile_summary_text` (human-readable controlled summary)
- Vectorize keeps the **embedding derived from that summary**

The embedding is not reversible to exact text. D1 keeps the structured scores because they are the input to deterministic ranking and user-facing assessment results.

### Future minimization (not current V1)

If stricter data minimization is desired later:

- delete `assessment_answers` after profile completion (keep only `dimension_scores_json`)
- expire old `match_suggestions` / resolved `match_requests` sooner
- reduce `match_events` retention

Current V1 keeps assessment answers and matching workflow rows until hard account reset.

## Matching Boundary

Workers AI and Vectorize are used for profile embedding and candidate discovery only. Final ranking, hard rejections, penalties, and tie breakers are deterministic TypeScript.

Accepted matches enter the same anonymous ticketing system as normal messages. Declined requests create no ticket.

## Forbidden Claims

Do not claim:

- perfect anonymity
- exact compatibility
- clinical/personality diagnosis
- dating compatibility
- E2EE
- zero-knowledge delivery
