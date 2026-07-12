import type { Context } from "grammy";

export type DeferWork = (promise: Promise<unknown>) => void;

export type NekoContext = Context & {
  deferWork?: DeferWork;
};
