# Bot Interaction V1

**Status:** current Telegram UX reference (filename retains V1; callbacks are V2).

How commands, reply keyboards, inline keyboards, drafts, and callback routing work. For sealed-ticket actions see [sealed-ticket-routing-and-inbox.md](./sealed-ticket-routing-and-inbox.md). For conversation suggestions see [conversation-suggestions-v2.md](./conversation-suggestions-v2.md).

## Canonical commands

Source of truth: `src/bot/commands.ts` (`BOT_COMMANDS`, `BOT_COMMAND_DEFINITIONS`).

| Command | Purpose |
|---------|---------|
| `/start` | Create or resume user; show personal deep link |
| `/inbox` | Deliver pending inbox pointers |
| `/settings` | Settings home (inline) |
| `/assessment` | Conversation profile dashboard (inline, `t:`) |
| `/match` | Suggestion hub (inline, `m:`) |

BotFather tooling (`tools/set-telegram-bot-profile.sh`) reads `BOT_COMMAND_DEFINITIONS` and verifies `getMyCommands`.

Unknown slash commands receive the generic Persian reply from `UNKNOWN_COMMAND_MESSAGE` in `src/i18n/messages.ts`.

## Main reply keyboard (persistent)

Four buttons only — defined in `src/bot/keyboards.ts`:

```text
🔗 لینک من          📥 صندوق پیام‌ها
🧭 پیشنهاد گفت‌وگو   ⚙️ تنظیمات
```

Routing: `src/bot/menu.ts` → `handleMainMenuCommand`.

| Label | Action |
|-------|--------|
| `🔗 لینک من` | Reply with personal `t.me/...?start={slug}` link |
| `📥 صندوق پیام‌ها` | Same as `/inbox` |
| `🧭 پیشنهاد گفت‌وگو` | `renderSuggestionHub` |
| `⚙️ تنظیمات` | `renderSettingsHome` (inline) |

## Draft input mode

When the user is composing text (message, reply, nickname, display name, conversation intro), the reply keyboard shows **only**:

```text
↩️ لغو
```

Implemented in `src/bot/input-navigation.ts`. Cancel clears the draft and restores the main menu.

`handleMessage` in `messaging-commands.ts` routes **draft input before main menu labels** so menu text cannot hijack an active draft.

## Inline surfaces

| Surface | Renderer | Callback prefix |
|---------|----------|-----------------|
| Settings home + confirmations | `renderSettingsHome`, `renderScreen` | `st:` |
| Suggestion hub + search results | `renderSuggestionHub`, suggestion handlers | `m:` (hub), `s:` (tickets) |
| Conversation profile flow | `sendProfileDashboard`, question UI | `t:` |
| Incoming request actions | request handlers | `q:` |
| Inbox message actions | `createMessageKeyboard` | `r:`, `b:`, `u:`, `n:`, `rp:` |
| Inbox pagination | `buildInboxPaginationKeyboard` | `ib:m:{offset}` |
| Open inbox from inline | `INBOX_MENU_CALLBACK.open` | `ib:open` |

Settings, suggestion hub, and profile use **inline keyboards only** — not reply keyboards.

## Suggestion hub entry points

All three render `renderSuggestionHub` in `src/features/conversation/suggestions/suggestion-hub.ts`:

- `/match`
- Main menu `🧭 پیشنهاد گفت‌وگو`
- Inline callback `m:hub`

## Active hub callbacks (`m:`)

Registered via `suggestionHubCallbackQueryRegex()`:

| Callback | Action |
|----------|--------|
| `m:hub` | Suggestion hub |
| `m:search` | Run candidate search + issue suggestion tickets |
| `m:pending` | Pending requests placeholder (incoming via bot notification) |
| `m:profile` | Conversation profile summary |
| `m:disc:on` / `m:disc:off` | Discoverability toggle |
| `m:assess` | Open profile dashboard (`/assessment` flow) |

## Suggestion ticket callbacks (`s:`)

| Callback | Action |
|----------|--------|
| `s:{ref}` | Mark suggestion viewed (optional) |
| `s:r:{ref}` | Start conversation intro draft |
| `s:d:{ref}` | Dismiss suggestion |

## Request ticket callbacks (`q:`)

| Callback | Action |
|----------|--------|
| `q:a:{ref}` | Accept request → sealed inbox ticket |
| `q:d:{ref}` | Decline request |
| `q:c:{ref}` | Cancel outgoing request |
| `q:{ref}` | Open/view (reserved) |

## Active inbox ticket callbacks

| Callback | Action |
|----------|--------|
| `r:{ref}` | Reply draft |
| `b:{ref}` | Block sender |
| `u:{ref}` | Unblock sender |
| `n:{ref}` | Private nickname draft |
| `rp:{ref}` | Report flow |

`{ref}` is a base64url capability ref (16–43 chars for conversation tickets; 32 chars for inbox tickets). Format enforced in handlers and `src/bot/callback-data.ts`.

## Unknown callbacks

`register-handlers.ts` registers specific handlers first, then a final catch-all:

- Answers every unmatched `callback_query`
- Replies with `EXPIRED_CALLBACK_MESSAGE` (`این دکمه دیگر در دسترس نیست.`)
- Does **not** translate legacy callback values or branch on removed payloads

## Handler wiring

| Concern | File |
|---------|------|
| Command + callback registration | `src/bot/register-handlers.ts` |
| Command list | `src/bot/commands.ts` |
| Main menu labels | `src/i18n/labels.ts`, `src/bot/menu.ts` |
| Inline screen edits | `src/bot/render-screen.ts` |
| Flow verification | `tools/verify-bot-flow.ts` |

## Manual QA

Test commands: `/start`, `/inbox`, `/settings`, `/assessment`, `/match`.

**Conversation V2 happy path:**

1. User A: `/assessment` → complete 25 questions
2. Wait for profile index (queue consumer); hub shows search ready
3. User A + B: enable **نمایش در پیشنهادها** in `/match`
4. User A: `m:search` → pick suggestion → write intro → send request
5. User B: receives notification with accept/decline → accept
6. User B: gets unread inbox notification (same path as normal anonymous messages) → **📥 باز کردن صندوق** or `/inbox` → reply; conversation continues as normal anonymous messaging

Test inbox actions: reply, block, unblock, nickname, report.

Deliberately tap an unsupported old inline button and confirm generic unavailable message.
