# Pre-release: Conversation Suggestions V2

**Date:** 2026-07-11  
**Tag:** `pre-release-conversation-v2-acca6b9`  
**Deployed worker commit:** `acca6b9` (version `65540c50-2f2d-491f-8aa6-6b24522fed82`)

## Summary

Conversation Suggestions V2 is implemented and signed off for pre-release. The bot surface is Telegram-only; public docs and the GitHub Pages intro at [mohetios.github.io/Nekonymous](https://mohetios.github.io/Nekonymous/) describe the current product.

## Release gates

| Gate | Result |
|------|--------|
| `pnpm check` | Pass |
| Remote `pnpm audit:d1` | Pass — V2 schema only; no forbidden V1 tables |
| Profile index idempotency tests | Pass (`pnpm test:profile-index-idempotency`) |
| Two-account Telegram E2E | User-verified on remote (assessment, profile, discoverability, search, messaging, settings) |
| Intro page + bot about copy | Aligned on 25 questions / 8 dimensions / schema `v2` |

## Public surfaces synced

| Surface | Path |
|---------|------|
| Intro page | `site/index.html` |
| README | `README.md` |
| Security policy | `SECURITY.md` |
| Contributing | `CONTRIBUTING.md` |
| Threat model | `docs/security/threat-model.md` |
| Bot UX reference | `docs/architecture/bot-interaction-v1.md` |
| Conversation V2 architecture | `docs/architecture/conversation-suggestions-v2.md` |
| Sealed ticket model | `docs/architecture/sealed-ticket-routing-and-inbox.md` |
| Persian voice guide | `docs/brand/nekonymous-fa-voice-and-tone.md` |
| Bot about screen | `ABOUT_PRIVACY_COMMAND_MESSAGE` + `PROJECT_INTRO_URL` button |

## Removed obsolete docs

V1 release audits and the V1→V2 source inventory were deleted after sign-off. See git history before this release if needed.

## Post-release monitoring (optional)

- DO / Vectorize / queue spot-checks under normal traffic
- GitHub Pages rebuild after doc pushes to `master`
