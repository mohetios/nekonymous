import type { Context } from "grammy";
import type { BotUser, D1User, Environment } from "../../types";
import {
  decryptDisplayName,
  decryptTelegramChatId,
  encryptDisplayName,
  encryptTelegramChatId,
  generateOpaqueId,
  hmacTelegramUserId,
} from "../../crypto/crypto-service";
import { getUserState, initUserState } from "../../storage/user-state-client";

export const ensureUserStateInitialized = async (
  env: Environment,
  userId: string
): Promise<void> => {
  try {
    await getUserState(env, userId);
  } catch {
    await initUserState(env, userId);
  }
};

const refreshTelegramChatIdIfNeeded = async (
  ctx: Context,
  user: D1User,
  env: Environment
): Promise<D1User> => {
  const chatId = ctx.chat?.id;
  if (chatId === undefined) {
    return user;
  }

  try {
    const stored = await decryptTelegramChatId(
      user.telegram_chat_ciphertext,
      env.APP_MASTER_KEY
    );
    if (stored === chatId) {
      return user;
    }
  } catch {
    // Re-encrypt below when ciphertext is missing or stale.
  }

  const ciphertext = await encryptTelegramChatId(chatId, env.APP_MASTER_KEY);
  const now = Date.now();
  await env.DB.prepare(
    "UPDATE users SET telegram_chat_ciphertext = ?, updated_at = ? WHERE id = ?"
  )
    .bind(ciphertext, now, user.id)
    .run();

  return { ...user, telegram_chat_ciphertext: ciphertext };
};

const LINK_ID_RE = /^[A-Za-z0-9_-]{20,24}$/;
const BOT_USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;
const DISPLAY_NAME_MAX_CHARS = 64;

const tgCacheKey = (hash: string): string => `tg:${hash}`;
const linkCacheKey = (slug: string): string => `link:${slug}`;

const bucketForHash = (hash: string): number => {
  const last = hash.charCodeAt(hash.length - 1) ?? 0;
  return last % 16;
};

export const isPublicSlug = (value: string): boolean => LINK_ID_RE.test(value);

export const buildUserDeepLink = (
  botUsername: string,
  slug?: string
): string => {
  const cleaned = botUsername.trim().replace(/^@/, "");
  if (!BOT_USERNAME_RE.test(cleaned)) {
    throw new Error("Invalid BOT_USERNAME");
  }
  const base = `https://t.me/${cleaned}?start`;
  return slug ? `${base}=${slug}` : base;
};

const initialDisplayName = (firstName: string | undefined): string => {
  if (!firstName) {
    return "بدون نام!";
  }
  const cleaned = firstName.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (!cleaned) {
    return "کاربر";
  }
  return [...cleaned].slice(0, DISPLAY_NAME_MAX_CHARS).join("");
};

const cacheUserRouting = async (
  env: Environment,
  userId: string,
  telegramHash: string,
  slug: string
): Promise<void> => {
  await Promise.all([
    env.NEKO_KV.put(tgCacheKey(telegramHash), userId),
    env.NEKO_KV.put(linkCacheKey(slug), userId),
  ]);
};

const rowToD1User = (row: Record<string, unknown>): D1User => ({
  id: String(row.id),
  telegram_user_hash: String(row.telegram_user_hash),
  telegram_chat_ciphertext: String(row.telegram_chat_ciphertext),
  locale: String(row.locale),
  locale_source: String(row.locale_source),
  onboarding_completed: Number(row.onboarding_completed),
  status: String(row.status),
  bucket_id: Number(row.bucket_id),
  created_at: Number(row.created_at),
  updated_at: Number(row.updated_at),
});

export const getUserById = async (
  userId: string,
  env: Environment
): Promise<D1User | null> => {
  const row = await env.DB.prepare(
    "SELECT * FROM users WHERE id = ? AND status = 'active'"
  )
    .bind(userId)
    .first();
  return row ? rowToD1User(row) : null;
};

export const getUserByTelegramHash = async (
  telegramHash: string,
  env: Environment
): Promise<D1User | null> => {
  const cachedId = await env.NEKO_KV.get(tgCacheKey(telegramHash));
  if (cachedId) {
    const user = await getUserById(cachedId, env);
    if (user) {
      return user;
    }
    await env.NEKO_KV.delete(tgCacheKey(telegramHash));
  }

  const row = await env.DB.prepare(
    "SELECT * FROM users WHERE telegram_user_hash = ? AND status = 'active'"
  )
    .bind(telegramHash)
    .first();

  return row ? rowToD1User(row) : null;
};

export const getUserByPublicSlug = async (
  slug: string,
  env: Environment
): Promise<D1User | null> => {
  const cachedId = await env.NEKO_KV.get(linkCacheKey(slug));
  if (cachedId) {
    const user = await getUserById(cachedId, env);
    if (user) {
      return user;
    }
    await env.NEKO_KV.delete(linkCacheKey(slug));
  }

  const row = await env.DB.prepare(
    `SELECT u.* FROM users u
     INNER JOIN public_links pl ON pl.owner_user_id = u.id
     WHERE pl.slug = ? AND pl.is_active = 1 AND u.status = 'active'`
  )
    .bind(slug)
    .first();

  return row ? rowToD1User(row) : null;
};

export const createPublicLinkForUser = async (
  userId: string,
  env: Environment
): Promise<string> => {
  const now = Date.now();
  const slug = generateOpaqueId(16);

  await env.DB.prepare(
    `INSERT INTO public_links (slug, owner_user_id, is_active, created_at, updated_at)
     VALUES (?, ?, 1, ?, ?)`
  )
    .bind(slug, userId, now, now)
    .run();

  await env.NEKO_KV.put(linkCacheKey(slug), userId);
  return slug;
};

export const createUserFromTelegram = async (
  ctx: Context,
  env: Environment
): Promise<D1User> => {
  const from = ctx.from;
  const chatId = ctx.chat?.id;
  if (!from || chatId === undefined) {
    throw new Error("Missing Telegram user context");
  }

  const telegramHash = await hmacTelegramUserId(
    env.APP_HMAC_PEPPER,
    from.id
  );
  const now = Date.now();
  const userId = generateOpaqueId(16);
  const chatCiphertext = await encryptTelegramChatId(
    chatId,
    env.APP_MASTER_KEY
  );
  const displayName = initialDisplayName(from.first_name);
  const displayCiphertext = await encryptDisplayName(
    displayName,
    env.APP_MASTER_KEY
  );

  try {
    await env.DB.prepare(
      `INSERT INTO users (
        id, telegram_user_hash, telegram_chat_ciphertext,
        locale, locale_source, onboarding_completed,
        status, bucket_id, created_at, updated_at
      ) VALUES (?, ?, ?, 'fa', 'fallback', 0, 'active', ?, ?, ?)`
    )
      .bind(
        userId,
        telegramHash,
        chatCiphertext,
        bucketForHash(telegramHash),
        now,
        now
      )
      .run();
  } catch {
    const existing = await getUserByTelegramHash(telegramHash, env);
    if (existing) {
      await ensureUserStateInitialized(env, existing.id);
      return existing;
    }
    throw new Error("Failed to create user");
  }

  const slug = await createPublicLinkForUser(userId, env);
  await cacheUserRouting(env, userId, telegramHash, slug);
  await initUserState(env, userId, displayCiphertext);

  const user = await getUserById(userId, env);
  if (!user) {
    throw new Error("Failed to create user");
  }
  return user;
};

export const resolveOrCreateUser = async (
  ctx: Context,
  env: Environment
): Promise<D1User> => {
  const from = ctx.from;
  if (!from) {
    throw new Error("Missing Telegram user");
  }

  const telegramHash = await hmacTelegramUserId(
    env.APP_HMAC_PEPPER,
    from.id
  );
  const existing = await getUserByTelegramHash(telegramHash, env);
  if (existing) {
    await ensureUserStateInitialized(env, existing.id);
    return refreshTelegramChatIdIfNeeded(ctx, existing, env);
  }

  return createUserFromTelegram(ctx, env);
};

export const getActiveSlugForUser = async (
  userId: string,
  env: Environment
): Promise<string | null> => {
  const row = await env.DB.prepare(
    `SELECT slug FROM public_links
     WHERE owner_user_id = ? AND is_active = 1
     ORDER BY created_at DESC LIMIT 1`
  )
    .bind(userId)
    .first<{ slug: string }>();

  return row?.slug ?? null;
};

export const deactivateUser = async (
  userId: string,
  env: Environment
): Promise<void> => {
  const now = Date.now();

  const [user, links] = await Promise.all([
    env.DB.prepare(
      "SELECT telegram_user_hash FROM users WHERE id = ?"
    )
      .bind(userId)
      .first<{ telegram_user_hash: string }>(),
    env.DB.prepare(
      "SELECT slug FROM public_links WHERE owner_user_id = ?"
    )
      .bind(userId)
      .all<{ slug: string }>(),
  ]);

  await env.DB.batch([
    env.DB.prepare(
      "UPDATE users SET status = 'deleted', updated_at = ? WHERE id = ?"
    ).bind(now, userId),
    env.DB.prepare(
      "UPDATE public_links SET is_active = 0, updated_at = ? WHERE owner_user_id = ?"
    ).bind(now, userId),
  ]);

  if (user) {
    await env.NEKO_KV.delete(tgCacheKey(user.telegram_user_hash));
  }

  for (const link of links.results ?? []) {
    await env.NEKO_KV.delete(linkCacheKey(link.slug));
  }
};

export const toBotUser = async (
  d1User: D1User,
  env: Environment
): Promise<BotUser> => {
  const [slug, state] = await Promise.all([
    getActiveSlugForUser(d1User.id, env),
    getUserState(env, d1User.id),
  ]);

  if (!slug) {
    throw new Error("User has no active public link");
  }

  let displayName = "بدون نام!";
  if (state.displayNameCiphertext) {
    try {
      displayName = await decryptDisplayName(
        state.displayNameCiphertext,
        env.APP_MASTER_KEY
      );
    } catch {
      displayName = "بدون نام!";
    }
  }

  const contactLabels: Record<string, string> = {};
  for (const label of state.labels) {
    try {
      contactLabels[label.alias] = await decryptDisplayName(
        label.nickname_ciphertext,
        env.APP_MASTER_KEY
      );
    } catch {
      // skip corrupt label
    }
  }

  return {
    id: d1User.id,
    slug,
    displayName,
    paused: state.paused,
    blockedUserIds: state.blockedUserIds,
    contactLabels,
    draft: state.draft ?? undefined,
    pendingSettings: state.draft?.pendingSettings,
    lastMessageAt: state.lastMessageAt,
  };
};

export const getTelegramChatId = async (
  d1User: D1User,
  env: Environment
): Promise<number> =>
  decryptTelegramChatId(
    d1User.telegram_chat_ciphertext,
    env.APP_MASTER_KEY
  );
