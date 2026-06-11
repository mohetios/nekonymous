# Nekonymous

Nekonymous is a secure and anonymous messaging bot for Telegram, allowing users to communicate without revealing their identity. Designed with privacy and security at its core, the bot employs advanced encryption techniques to ensure that all messages remain secure and private. The bot is deployed on Cloudflare Workers, offering high performance and global distribution.

## How It Works

### 1. User Interaction

- **Starting a Conversation**: Users initiate interaction with the bot using the `/start` command.
- **Unique Links**: The bot generates a unique UUID for each user and provides a personalized link that can be shared with others.
- **Anonymous Messaging**: When someone uses this link, they can send anonymous messages to the original user without revealing their identity.
- **Rate Limiting**: The bot implements rate limiting to prevent users from sending too many messages in a short period.

### 2. Message Flow

- **Encryption**: Messages are encrypted and stored securely using AES-GCM encryption and are stored in a secure manner.
- **Durable Objects**: The bot uses Cloudflare Durable Objects to manage user inboxes, ensuring consistent and scalable storage.
- **Notification**: The recipient is notified of new messages and can reply anonymously.
- **Reply Handling**: Replies are routed back to the sender, maintaining the anonymity of both parties.
- **Self-Messaging Prevention**: Users cannot send anonymous messages to themselves.

### 3. Blocking Users

- **User Control**: Users can block or unblock senders using inline buttons within the conversation, effectively filtering unwanted messages.
- **Statistics**: The bot tracks blocking and unblocking actions, providing insights into user interactions.

### 4. User Privacy

- **Anonymity**: The bot ensures no identifying information is leaked. UUIDs are randomly generated and do not correlate with any real user data.
- **Key Management**: Each conversation is secured with a unique key, ensuring that only the intended participants can access the messages.

## Security Overview

### 1. Ticketing System

The bot uses a robust ticketing system to manage message encryption and decryption. Each conversation is secured using a unique ticket ID that functions as a private key. This key is generated for each new conversation and is never stored in plain text.

- **Ticket ID**: Random entropy mixed with `APP_SECURE_KEY` via SHA-256; stored in the inbox as an opaque handle.
- **APP_SECURE_KEY**: Worker secret used with each ticket to derive encryption and lookup keys.
- **Conversation ID**: A separate SHA-256 digest used as the KV storage key (not stored in plaintext on the inbox).

### 2. Encryption and Decryption Process

Messages sent through the bot are encrypted using AES-GCM encryption, ensuring that only the intended recipient can read the messages, even if intercepted by unauthorized parties.

- **Encryption**: AES-GCM via the Workers Web Crypto API. Key material is SHA-256(ticket bytes + `APP_SECURE_KEY`).
- **Decryption**: The same derivation path decrypts the payload when the recipient opens their inbox.

### 3. Cloudflare Workers and Durable Objects

The bot is hosted on Cloudflare Workers, providing a secure, scalable environment for processing requests. User data and conversations are stored using Cloudflare's Durable Objects, which provide consistent storage with automatic synchronization.

### 4. Data Integrity and Tamper Protection

Combining the ticket ID with the APP_SECURE_KEY ensures that encryption keys maintain integrity, protecting against tampering and unauthorized decryption attempts.

### 5. Request Authentication

The bot only accepts requests from the official Telegram API by validating the `X-Telegram-Bot-Api-Secret-Token` header, protecting against unauthorized requests.

## Getting Started

Follow these steps to set up the development environment and get the bot running locally.

### Prerequisites

- **Node.js** 22+ (matches CI)
- **pnpm** 9+
- **Cloudflare account** with Workers, KV, and Durable Objects
- **`wrangler.toml`** in the project root (gitignored; copy from your deployment config)

### Install

```bash
pnpm install
```

### Local environment

1. Copy the template: `cp .env.example .env` and `cp .env.example .dev.vars`
2. Fill in `SECRET_TELEGRAM_API_TOKEN`, `BOT_SECRET_KEY`, `APP_SECURE_KEY`, `BOT_INFO` (`getMe` JSON), and `PRODUCTION_WEBHOOK_URL`.
3. Run `pnpm dev` — Wrangler loads secrets from `.dev.vars`.

Do not commit `.env` or `.dev.vars`.

### Quality checks

```bash
pnpm check   # typecheck, lint, knip, crypto roundtrip test
```

CI runs `pnpm check` on every push and pull request.

### Deploy

```bash
pnpm deploy
```

Pushes to `master` also deploy via GitHub Actions (requires `CF_API_TOKEN`, `CF_ACCOUNT_ID`, and `CF_ZONE_ID` secrets).

See [AGENTS.md](AGENTS.md) for architecture notes and contributor conventions.

### Local Telegram bot (without hitting deployed worker)

One command (wrangler + tunnel + webhook setup):

```bash
pnpm dev:telegram
```

Requires `.dev.vars` with `SECRET_TELEGRAM_API_TOKEN`, `BOT_SECRET_KEY`, and `PRODUCTION_WEBHOOK_URL` for auto-restore on Ctrl+C.

Plain local worker only (no Telegram redirect):

```bash
pnpm dev
```

**Safer alternative:** use a second @BotFather bot token in `.dev.vars` so production webhook stays untouched.

Check webhook: `pnpm webhook:info` · Restore manually: `pnpm webhook:restore`

