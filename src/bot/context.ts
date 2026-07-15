import type { Context } from "grammy";
import type { D1User } from "../contracts/identity/model";
import type { Environment } from "../contracts/runtime";
import { resolveOrCreateUser } from "../features/identity/identity-service";

export type DeferWork = (promise: Promise<unknown>) => void;

export type NekoContext = Context & {
  deferWork?: DeferWork;
  actor?: D1User;
};

export const setResolvedUser = (ctx: Context, user: D1User): void => {
  (ctx as NekoContext).actor = user;
};

export const getResolvedUser = async (
  ctx: Context,
  env: Environment
): Promise<D1User> => {
  const nekoCtx = ctx as NekoContext;
  if (nekoCtx.actor) {
    return nekoCtx.actor;
  }
  const user = await resolveOrCreateUser(ctx, env);
  nekoCtx.actor = user;
  return user;
};
