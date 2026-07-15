import type { Context } from "grammy";
import type { BotUser, D1User } from "../../contracts/identity/model";
import type { Environment } from "../../contracts/runtime";
import type { D1UserStatus } from "../../contracts/identity/model";
import {
  decryptDisplayName,
  decryptTelegramChatId,
  encryptDisplayName,
  encryptTelegramChatId,
  generateOpaqueId,
  hmacTelegramUserId,
} from "../ticketing/ticketing-service";
import {
  getUserState,
  initUserState,
  listUnreadItemsForReset,
  purgeUserState,
} from "../../storage/user-state-client";
import { isDurableObjectCallError } from "../../storage/durable-object-call-error";
import { invalidateUserConversationProfile } from "../conversation/profile/profile-service";
import { deleteTicketRecord } from "../../storage/ticket-vault/ticket-vault.client";
import { createTicketHash } from "../ticketing/keys";
import { openUnreadCapability } from "../ticketing/unread-capability";
import { parseTicketCapability } from "../ticketing/ticket-capability";
import {
  recordLinkCreated,
  recordUserCreated,
} from "../../stats/product-events";
import {
  DISPLAY_NAME_DEFAULT,
  DISPLAY_NAME_EMPTY,
} from "../../i18n/defaults";
import { logBotError } from "../../utils/logs";
import { stripControlCharacters, truncateGraphemes } from "../../utils/text";

const isTelegramUserHashConflict = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("unique constraint") &&
    message.includes("telegram_user_hash")
  );
};

const kvGet = async (
  env: Environment,
  key: string
): Promise<string | null> => {
  try {
    return await env.NEKO_KV.get(key);
  } catch (error) {
    logBotError("kv:get", error);
    return null;
  }
};

const kvPut = async (
  env: Environment,
  key: string,
  value: string
): Promise<void> => {
  try {
    await env.NEKO_KV.put(key, value);
  } catch (error) {
    logBotError("kv:put", error);
  }
};

const kvDelete = async (env: Environment, key: string): Promise<void> => {
  try {
    await env.NEKO_KV.delete(key);
  } catch (error) {
    logBotError("kv:delete", error);
  }
};

export const ensureUserStateInitialized = async (
  env: Environment,
  userId: string
): Promise<void> => {
  try {
    await getUserState(env, userId);
  } catch (error) {
    if (isDurableObjectCallError(error) && error.status === 404) {
      await initUserState(env, userId);
      return;
    }
    throw error;
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
    return DISPLAY_NAME_EMPTY;
  }
  const cleaned = stripControlCharacters(firstName).trim();
  if (!cleaned) {
    return DISPLAY_NAME_DEFAULT;
  }
  return truncateGraphemes(cleaned, DISPLAY_NAME_MAX_CHARS);
};

const cacheUserRouting = async (
  env: Environment,
  userId: string,
  telegramHash: string,
  slug: string
): Promise<void> => {
  await Promise.all([
    kvPut(env, tgCacheKey(telegramHash), userId),
    kvPut(env, linkCacheKey(slug), userId),
  ]);
};

const rowToD1User = (row: Record<string, unknown>): D1User => ({
  id: String(row.id),
  telegram_user_hash: String(row.telegram_user_hash),
  telegram_chat_ciphertext: String(row.telegram_chat_ciphertext),
  locale: String(row.locale),
  locale_source: String(row.locale_source),
  onboarding_completed: Number(row.onboarding_completed),
  status: String(row.status) as D1UserStatus,
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
  const cachedId = await kvGet(env, tgCacheKey(telegramHash));
  if (cachedId) {
    const user = await getUserById(cachedId, env);
    if (user) {
      return user;
    }
    await kvDelete(env, tgCacheKey(telegramHash));
  }

  const row = await env.DB.prepare(
    "SELECT * FROM users WHERE telegram_user_hash = ? AND status = 'active'"
  )
    .bind(telegramHash)
    .first();

  return row ? rowToD1User(row) : null;
};

const getUserByTelegramHashAnyStatus = async (
  telegramHash: string,
  env: Environment
): Promise<D1User | null> => {
  const row = await env.DB.prepare(
    "SELECT * FROM users WHERE telegram_user_hash = ?"
  )
    .bind(telegramHash)
    .first();

  return row ? rowToD1User(row) : null;
};

/** Permanently remove a user and all D1 rows tied to them. KV best-effort. */
export const hardDeleteUserAccount = async (
  userId: string,
  env: Environment
): Promise<void> => {
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
    env.DB.prepare("DELETE FROM public_links WHERE owner_user_id = ?").bind(
      userId
    ),
    env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId),
  ]);

  if (user) {
    await kvDelete(env, tgCacheKey(user.telegram_user_hash));
  }
  for (const link of links.results ?? []) {
    await kvDelete(env, linkCacheKey(link.slug));
  }
};

export const getUserByPublicSlug = async (
  slug: string,
  env: Environment
): Promise<D1User | null> => {
  const cachedId = await kvGet(env, linkCacheKey(slug));
  if (cachedId) {
    const user = await getUserById(cachedId, env);
    if (user) {
      return user;
    }
    await kvDelete(env, linkCacheKey(slug));
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

  const slug = generateOpaqueId(16);

  const insertUserAndLink = async (): Promise<"inserted" | "duplicate"> => {
    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO users (
            id, telegram_user_hash, telegram_chat_ciphertext,
            locale, locale_source, onboarding_completed,
            status, bucket_id, created_at, updated_at
          ) VALUES (?, ?, ?, 'fa', 'default', 0, 'active', ?, ?, ?)`
        ).bind(
          userId,
          telegramHash,
          chatCiphertext,
          bucketForHash(telegramHash),
          now,
          now
        ),
        env.DB.prepare(
          `INSERT INTO public_links (slug, owner_user_id, is_active, created_at, updated_at)
           VALUES (?, ?, 1, ?, ?)`
        ).bind(slug, userId, now, now),
      ]);
      return "inserted";
    } catch (error) {
      if (isTelegramUserHashConflict(error)) {
        return "duplicate";
      }
      throw error;
    }
  };

  if ((await insertUserAndLink()) === "duplicate") {
    const existing = await getUserByTelegramHash(telegramHash, env);
    if (existing) {
      await ensureUserStateInitialized(env, existing.id);
      return refreshTelegramChatIdIfNeeded(ctx, existing, env);
    }

    const leftover = await getUserByTelegramHashAnyStatus(telegramHash, env);
    if (leftover) {
      await hardDeleteUserAccount(leftover.id, env);
    }

    if ((await insertUserAndLink()) === "duplicate") {
      throw new Error("Failed to create user");
    }
  }

  await cacheUserRouting(env, userId, telegramHash, slug);
  await initUserState(env, userId, displayCiphertext);
  await recordUserCreated(env);
  await recordLinkCreated(env);

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

export const clearUserAccountAndRecreate = async (
  ctx: Context,
  userId: string,
  env: Environment
): Promise<D1User> => {
  // Profile invalidation must succeed before rotating the account — silent
  // failure can leave discoverable vectors / vault state orphaned under the
  // deleted user id while the user believes reset completed.
  await invalidateUserConversationProfile(env, userId);
  const unreadItems = await listUnreadItemsForReset(env, userId).catch(() => []);
  await Promise.all(
    unreadItems.map(async (item) => {
      try {
        const encoded = await openUnreadCapability(
          env.APP_MASTER_KEY,
          userId,
          item.itemId,
          item.dedupeTag,
          item.sealedCapabilityEnc
        );
        const ticketHash = await createTicketHash(
          env.APP_HMAC_PEPPER,
          parseTicketCapability(encoded)
        );
        await deleteTicketRecord(env, ticketHash);
      } catch {
        // UserState purge still removes the unread row; account rotation invalidates callbacks.
      }
    })
  );
  await purgeUserState(env, userId);
  await hardDeleteUserAccount(userId, env);
  return createUserFromTelegram(ctx, env);
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

  let displayName = DISPLAY_NAME_EMPTY;
  if (state.displayNameCiphertext) {
    try {
      displayName = await decryptDisplayName(
        state.displayNameCiphertext,
        env.APP_MASTER_KEY
      );
    } catch {
      displayName = DISPLAY_NAME_EMPTY;
    }
  }

  return {
    id: d1User.id,
    slug,
    displayName,
    paused: state.paused,
    blockTags: state.blockTags,
    ...(state.draft ? { draft: state.draft } : {}),
    ...(state.draft?.pendingSettings
      ? { pendingSettings: state.draft.pendingSettings }
      : {}),
    ...(state.lastMessageAt !== undefined
      ? { lastMessageAt: state.lastMessageAt }
      : {}),
  };
};
