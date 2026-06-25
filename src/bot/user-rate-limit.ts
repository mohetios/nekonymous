import type { Context, NextFunction } from "grammy";
import type { Environment } from "../types";
import { resolveOrCreateUser } from "../features/identity/identity-service";
import {
  RATE_LIMIT_CALLBACK_ALERT,
  RATE_LIMIT_MESSAGE,
} from "../i18n/messages";
import { consumeUserRateLimit } from "../storage/user-state-client";

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
    try {
      const user = await resolveOrCreateUser(ctx, env);
      userId = user.id;
    } catch {
      await next();
      return;
    }

    if (await consumeUserRateLimit(env, userId)) {
      await replyRateLimited(ctx);
      return;
    }

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
