# Persian Interactive Copy Audit V1

## Surfaces inspected

- `src/i18n/messages.ts`: welcome, link, compose, inbox, reply, nickname, block, report, privacy/about, errors, rate limit.
- `src/i18n/labels.ts`: reply keyboard, inline buttons, draft cancel label, input placeholders, BotFather command descriptions.
- `src/i18n/settings.ts`: settings home, display name, pause/resume toasts, block-list reset, suggestion-history reset, hard account reset.
- `src/i18n/matching.ts`: suggestion hub, search states, profile copy, request lifecycle, incoming/outgoing request rendering copy.
- `src/i18n/assessment-ui.ts`: assessment dashboard, progress, answer scale, reset, exit, result headers.
- `src/bot/*`: command definitions, main menu routing, draft input keyboard, callback catch-all.
- `src/features/messaging/*`: `/start`, compose draft, `/inbox`, pagination, ticket actions, outbox notification copy.
- `src/features/settings/*`: settings callbacks, confirmation screens, status rendering.
- `src/features/matching/*`: suggestion hub status lines, request and search UI.
- `src/features/assessment/*`: dashboard and question/result rendering.
- `src/stats/stats-format.ts`: public aggregate stats copy.
- `tools/set-telegram-bot-profile.sh`: Telegram public profile description and short description.
- `tools/verify-*`: copy-sensitive verification fixtures.

## Files changed

- `docs/brand/nekonymous-fa-voice-and-tone.md` created.
- `docs/release/fa-interactive-copy-audit-v1.md` created.
- `src/i18n/messages.ts`
- `src/i18n/labels.ts`
- `src/i18n/settings.ts`
- `src/i18n/matching.ts`
- `src/i18n/assessment-ui.ts`
- `src/bot/commands.ts`
- `src/bot/input-navigation.ts`
- `src/features/messaging/render-inbox.ts`
- `src/features/settings/settings-handlers.ts`
- `src/features/settings/settings-home.ts`
- `src/features/matching/suggestion-hub.ts`
- `src/stats/stats-format.ts`
- `tools/set-telegram-bot-profile.sh`
- `tools/verify-bot-flow.ts`
- `tools/verify-stats.ts`

## Strings rewritten

- Welcome now introduces Neko once as the orange cat relay and keeps privacy out of `/start`.
- Personal link copy now uses `لینک پیام ناشناس` / `پیام ناشناس` as the central vocabulary.
- Compose and reply prompts are shorter, Telegram-friendly, and clear about anonymous delivery.
- Success states now use concise `پیامت رسید 🐾` / `جوابت رسید 🐾`.
- Empty inbox and new-message notification use limited cat reactions.
- Generic, unknown-command, expired callback, unsupported message, and rate-limit copy now share the new voice.
- Nickname copy clarifies that the name is private and sender-visible claims are avoided.
- Block, report, reset, privacy, and destructive confirmation copy use serious tone without decorative cat language.
- Settings, pause/resume, block-list reset, suggestion-history reset, and hard reset copy were made clearer.
- Assessment dashboard copy avoids personality-test framing and uses `ارزیابی سبک گفت‌وگو`.
- Conversation suggestions avoid match/dating language and use `پیشنهاد گفت‌وگو`, `درخواست گفت‌وگو`, and `پیام شروع گفت‌وگو`.
- Telegram public profile Persian copy was aligned with the new voice and privacy boundaries.
- Public stats empty/error copy was lightly aligned.

## Hard-coded strings moved

- Draft cancel label and input placeholders moved from `src/bot/input-navigation.ts` to `src/i18n/labels.ts`.
- Bot command descriptions moved to `src/i18n/labels.ts` and are consumed by `src/bot/commands.ts`.
- Inbox pagination message moved from `render-inbox.ts` to `src/i18n/messages.ts`.
- Settings callback toasts moved from `settings-handlers.ts` to `src/i18n/settings.ts`.
- Suggestion hub status lines moved from `suggestion-hub.ts` to `src/i18n/matching.ts`.

## Strings intentionally preserved

- Assessment question bank in `src/features/assessment/question-bank.ts` is preserved as product assessment content, not generic interaction microcopy.
- Assessment scoring/profile summary text in `src/features/assessment/scoring.ts` and `profile-summary.ts` is preserved because it feeds stored profile summaries and embedding text; only surrounding UI copy was rewritten.
- Internal `match` identifiers, callback prefixes, command names, D1/DO/KV names, and test/tool internal English strings were preserved.
- Negative privacy statements using forbidden terms were preserved where they explicitly say what the system is not.

## Sensitive/privacy copy reviewed

- About/privacy says Telegram and Worker see plaintext during processing.
- About/privacy says Nekonymous is not E2EE or zero-knowledge and does not guarantee complete anonymity.
- About/privacy says sensitive stored data is encrypted at rest where implemented.
- About/privacy says message payload text is cleared after successful inbox display, while route/action material may remain until expiry.
- Report success is short and serious.
- Block/unblock and hard reset copy avoid jokes and decorative emoji.

## Forbidden terms results

Command:

```bash
rg -n "مچ|مچ‌یابی|درصد سازگاری|سازگارترین|تست شخصیت|تشخیص شخصیت|نیمه گمشده" src tools docs/brand
```

Result: only `docs/brand/nekonymous-fa-voice-and-tone.md` contains these terms in the forbidden-words list and QA checklist.

Command:

```bash
rg -n "ناشناس کامل|ناشناسی کامل|کاملاً امن|امن‌ترین|رمزنگاری سرتاسری|هیچ.?کس نمی.?فهم" src tools docs/brand
```

Result: allowed negative/privacy exceptions remain in:

- `src/i18n/messages.ts` about/privacy negative disclaimer.
- `tools/set-telegram-bot-profile.sh` Persian public description negative disclaimer.
- `docs/brand/nekonymous-fa-voice-and-tone.md` forbidden list and negative examples.

Command:

```bash
rg -n "در کوچیک|در کوچک|صندوقچه|مِروپ|mrrp|پررر|هیس" src tools
```

Result: no matches.

Command:

```bash
rg -n "[\u0600-\u06FF]" src tools
```

Result: reviewed. Remaining Persian outside `src/i18n` is assessment content, scoring/profile summary generation, public stats formatter, profile setup script, and verification fixtures.

## Commands/buttons verified

- Public command names unchanged: `/start`, `/inbox`, `/settings`, `/assessment`, `/match`.
- Callback prefixes unchanged: `r:`, `b:`, `u:`, `n:`, `rp:`, `ib:`, `t:`, `m:`, `s:`.
- Button labels shortened or clarified, but callback data construction was not changed.
- `tools/verify-bot-flow.ts` updated to account for draft label moving to i18n.

## Parse mode checks

- HTML copy still uses existing `withHtml` / `replyHtml` call sites.
- Placeholders preserved: `UUID_USER_URL`, `USER_NAME`, `CURRENT_NICK`, `NAME`, `COUNT`, `REQUEST_COUNT`, `BLOCK_COUNT`, `{incoming}`, `{outgoing}`.
- Link placeholders remain wrapped in `<code>`.
- User-provided dynamic values still go through existing escaping helpers.
- Callback toast strings remain short.

## Remaining manual checks

- First `/start`
- Returning `/start`
- Opening another user's deep link
- Compose and cancel
- Successful anonymous send
- Empty inbox
- Inbox with active message
- Viewed/expired message shell
- Reply flow
- Private nickname set/remove
- Block/unblock
- Report
- Pause/resume
- Assessment start/continue/complete
- Suggestion search and empty state
- Request sent/accepted/declined/canceled
- Rate limit
- Unknown command
- Generic error
- Reset suggestion history
- Hard reset confirmation
- About/privacy page

## Checks run

- `rg -n "[\u0600-\u06FF]" src tools`
- `rg -n "ctx\.reply|reply\(|answerCallbackQuery|editMessageText|sendMessage" src`
- `rg -n "keyboard|InlineKeyboard|Keyboard|callback" src`
- `rg -n "مچ|مچ‌یابی|درصد سازگاری|سازگارترین|تست شخصیت|تشخیص شخصیت|نیمه گمشده" src tools docs/brand`
- `rg -n "ناشناس کامل|ناشناسی کامل|کاملاً امن|امن‌ترین|رمزنگاری سرتاسری|هیچ.?کس نمی.?فهم" src tools docs/brand`
- `rg -n "در کوچیک|در کوچک|صندوقچه|مِروپ|mrrp|پررر|هیس" src tools`
- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm test` passed.
- `pnpm check` passed.
