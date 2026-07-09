# Public Surface Verification V1

**Date:** 2026-07-07  
**Scope:** Final release gate for user-facing and public-facing text — no feature changes.

## Summary

Public surfaces were audited against the V1 product canon (Persian-first anonymous Telegram relay; conversation-style assessment; optional conversation suggestions; explicit non-goals). Bot copy in `src/i18n/` passes forbidden-term checks (negatives only). Keyboards and callbacks match the reply-vs-inline UX rules. `tools/set-telegram-bot-profile.sh` was aligned to recommended Persian BotFather strings (within Telegram length limits). `site/index.html` was copy-audited (stale DO name, English discoverability, encryption wording, docs links). `AGENTS.md` was synced to sealed-ticket architecture, current bindings, docs map, and V1 release mode.

**Risk:** Ready for manual Telegram release test — not release-ready until BotFather profile applied and live flows verified.

## Bot copy audited

| Area | Files | Result |
|------|-------|--------|
| Core messages | `src/i18n/messages.ts` | OK — canon intro, negative privacy limits |
| Labels / keyboards | `src/i18n/labels.ts` | OK — preferred Persian terms |
| Settings | `src/i18n/settings.ts` | OK |
| Matching | `src/i18n/matching.ts` | OK — negatives for سازگاری/تست شخصیت/دوستیابی |
| Assessment UI | `src/i18n/assessment-ui.ts` | OK — «نه تشخیص شخصیت» |
| Feature handlers | `src/features/**` | OK — no forbidden positive framing in user strings |

## Persian terminology changes

No new bot copy changes in this pass (prior UX pass already applied). Verification confirmed preferred terms in live UI:

- پیشنهاد گفت‌وگو (not مچ‌یابی)
- ارزیابی سبک گفت‌وگو (not تست شخصیت)
- صندوق پیام‌ها, نام خصوصی, نمایش در پیشنهادها

**Settings menu note:** Release checklist originally listed `🧾 نکات فنی`; product now uses `📊 آمار` paired with `ℹ️ درباره و حریم خصوصی` (stats page replaces separate technical-about screen). This is intentional current UX.

## Keyboard/callback checks

### Main menu (reply)

```txt
🔗 لینک من
🧭 پیشنهاد گفت‌وگو
⚙️ تنظیمات
```

### Settings menu (reply)

```txt
✏️ نام نمایشی | ⏸/▶️ pause/resume
🚫 رفع مسدودی‌ها | ♻️ بازنشانی پیشنهادها
ℹ️ درباره و حریم خصوصی | 📊 آمار
🗑️ پاک کردن حساب
🏠 منوی اصلی
```

### Inbox inline actions

```txt
💬 پاسخ دادن
🏷️ نام خصوصی
🚫 مسدود کردن / 🔓 رفع مسدودی
⚠️ گزارش کردن
```

### Conversation-suggestions hub (reply)

Dynamic rows in `buildMatchSystemMenu`: درخواست‌ها + پروفایل; پیدا کردن + فعال/توقف نمایش; assessment entry; منوی اصلی.

### Callback data

- Inbox: `o:`, `r:`, `b:`, `u:`, `n:`, `rp:` + 32-char base64url ref (`src/utils/telegram-callbacks.ts`)
- Settings: `s:yd`, `s:yb`, `s:yr`, `s:n`
- Assessment: `t:` prefix
- Matching: `m:` prefix
- Match-system inline: `ms:` prefix
- Language-independent, no Persian in callback_data, 64-byte guard on inbox callbacks
- Handlers call `answerCallbackQuery` where required

## Telegram profile strings

Source: `tools/set-telegram-bot-profile.sh` (apply with `pnpm bot:profile` when ready — **not run in this pass**).

| Field | Language | Chars | Limit | Status |
|-------|----------|-------|-------|--------|
| Name | — | — | — | `نِکونیموس` |
| Short description | fa | 101 | 120 | Updated |
| Description | fa | 466 | 512 | Updated |
| Short description | en | — | 120 | Unchanged (canonical EN) |
| Description | en | — | 512 | Unchanged |

### Commands (fa)

```txt
start - شروع و دریافت لینک ناشناس
inbox - دیدن صندوق پیام‌ها
settings - تنظیمات و حریم خصوصی
assessment - ارزیابی سبک گفت‌وگو
match - پیشنهادهای گفت‌وگو
match_system - نکات فنی پیشنهاد گفت‌وگو
```

### Recommended Persian short description (applied)

```txt
لینک شخصی برای دریافت پیام ناشناس، پاسخ ناشناس، و پیشنهاد گفت‌وگوی اختیاری با مرزهای روشن حریم خصوصی.
```

### Recommended Persian long description (applied)

```txt
نکونیموس یک ربات پیام ناشناس فارسی‌محور است.

با آن می‌توانی لینک شخصی بسازی، پیام ناشناس بگیری، ناشناس پاسخ بدهی، دریافت پیام را متوقف یا فعال کنی، و اگر خواستی از ارزیابی سبک گفت‌وگو و پیشنهاد گفت‌وگوی اختیاری استفاده کنی.

نکونیموس ناشناسی کامل یا رمزنگاری سرتاسری ادعا نمی‌کند. تلگرام و زیرساخت پردازش بات هنگام ارسال و دریافت پیام، متن پیام را می‌بینند. هدف محصول این است که کاربران در جریان معمول از هم پنهان بمانند و داده‌های ذخیره‌شده تا حد ممکن محدود باشند.
```

## site/index.html audit

| Check | Result |
|-------|--------|
| No secure-messenger / E2EE positive claims | OK — negatives only |
| No dating / personality-test framing | OK |
| No payments as implemented | OK |
| Matches README positioning | OK |
| Live doc links only | OK — sealed-ticket, threat-model, matching-v1 |
| Stale infra names | Fixed `TicketVaultShardDO` → `TicketVaultDO` |
| English discoverability in product card | Fixed → «نمایش در پیشنهادها» |
| Encryption wording | Fixed → «رمزنگاری در حالت سکون» |
| Duplicate README doc link | Replaced with GitHub Pages link |

Static landing remains short: intro, product cards, infra summary, stats boundary, doc links, GitHub + bot CTA.

## AGENTS.md sync

Updated in this pass:

- V1 code-frozen release mode and docs source-of-truth map
- Persian terminology guidance for editors
- Sealed-ticket + inbox-pointer model (replacing stale `inbox_tickets` / payload-in-DO wording)
- Current DOs, queues (`neko-outbox`, `neko-stats`), bindings (`TICKET_VAULT`, `REPORT_LEDGER`)
- i18n file map, stats event pipeline, `pnpm check` script list
- Conversation suggestions naming (not matchmaking)

## Grep exceptions

### Persian forbidden terms (`src/`)

| Term | Location | Reason |
|------|----------|--------|
| `رمزنگاری سرتاسری`, `ناشناسی کامل` | `messages.ts` | Negative disclaimer |
| `درصد سازگاری`, `تست شخصیت`, `تشخیص شخصیت`, `دوستیابی` | `matching.ts` | Negative disclaimer |
| `تشخیص شخصیت` | `assessment-ui.ts` | Negative disclaimer |
| `صندوق پیام‌ها` | `settings.ts` | Allowed term (contains partial match in grep for `مچ` — false positive on substring) |

### Persian forbidden terms (docs / site)

| Term | Location | Reason |
|------|----------|--------|
| Same negatives | `site/index.html`, `nekonymous-fa.md` | Explicit «چی نیست» sections |
| Audit references | `public-surface-verification-v1.md` | Current release audit checklist |

### English forbidden terms

| Term | Location | Reason |
|------|----------|--------|
| `E2EE`, `zero-knowledge`, `dating`, `compatibility`, etc. | `README.md`, `SECURITY.md`, `threat-model.md`, `matching-v1.md`, `CONTRIBUTING.md` | Non-goals / limitations |
| `compatibility_date` | `wrangler.jsonc` | Cloudflare Workers config field — not product claim |
| `conversationId` | `AGENTS.md` | Internal code identifier note |
| `compatibility` in matching-v1 | Architecture limitations section | Technical negative |

No unexplained positive occurrences in live user-facing surfaces.

## Commands run

| Command | Result |
|---------|--------|
| `rg` Persian forbidden terms | Pass — negatives/archived only |
| `rg` English forbidden terms | Pass — disclaimers/config only |
| `node` char count for BotFather strings | short=101, long=466 |
| `pnpm check` | Pass (typecheck, lint, knip, test:*, audit:ticket-storage) |

## Remaining manual checks

- [ ] Run/apply `pnpm bot:profile` if not applied to production BotFather
- [ ] Verify BotFather profile visually (name, descriptions, commands)
- [ ] Real Telegram flow test (link → send → inbox → reply → block → assessment → suggestion → request)
- [ ] Verify [mohetios.github.io/Nekonymous/](https://mohetios.github.io/Nekonymous/)
- [ ] Draft GitHub release
