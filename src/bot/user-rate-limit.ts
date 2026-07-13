import type { Context, NextFunction } from "grammy";
import type { Environment } from "../contracts/runtime";
import { resolveOrCreateUser } from "../features/identity/identity-service";
import {
  RATE_LIMIT_CALLBACK_ALERT,
  RATE_LIMIT_MESSAGE,
} from "../i18n/messages";
import { consumeUserRateLimit } from "../storage/user-state-client";
import { emitUserActive } from "../stats/emit-user-active";
import { type NekoContext } from "./context";

const isUserInputUpdate = (ctx: Context): boolean =>
  ctx.message !== undefined || ctx.callbackQuery !== undefined;

export const createUserRateLimitMiddleware =
  (env: Environment) =>
  async (ctx: Context, next: NextFunction): Promise<void> => {
    if (!ctx.from || !isUserInputUpdate(ctx)) {
      await next();
      return;
    }

    let userId: string;
    let actorHash: string;
    try {
      const user = await resolveOrCreateUser(ctx, env);
      userId = user.id;
      actorHash = user.telegram_user_hash;
    } catch {
      await next();
      return;
    }

    if (await consumeUserRateLimit(env, userId)) {
      await replyRateLimited(ctx);
      return;
    }

    const nekoCtx = ctx as NekoContext;
    nekoCtx.deferWork?.(emitUserActive(env, actorHash));

    await next();
  };

const replyRateLimited = async (ctx: Context): Promise<void> => {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({
      text: RATE_LIMIT_CALLBACK_ALERT,
      show_alert: false,
    });
    return;
  }

  if (ctx.message) {
    await ctx.reply(RATE_LIMIT_MESSAGE);
  }
};
