import type { Context } from "grammy";
import type { Environment } from "../../types";
import { decryptEnvelope } from "../ticketing/envelope";
import {
  createOwnerProofTag,
  createTicketHash,
  deriveTicketKey,
  routeAad,
} from "../ticketing/keys";
import { constantTimeEqual } from "../ticketing/hmac";
import { hmacTelegramUserId } from "../ticketing/ticketing-service";
import {
  getTicketRecord,
  TicketExpiredError,
} from "../../storage/ticket-vault/ticket-vault.client";
import type { TicketVaultRecord } from "../../storage/ticket-vault/ticket-vault.types";
import type { RouteCapsule } from "./create-sealed-ticket";
import { isCallbackRef } from "../../utils/telegram-callbacks";

export type TicketAction =
  | "open"
  | "reply"
  | "block"
  | "unblock"
  | "report"
  | "nickname";

export type ResolvedTicketAction = {
  action: TicketAction;
  ticketRef: string;
  ticketHash: string;
  actorHash: string;
  ticket: TicketVaultRecord;
  ticketKey: CryptoKey;
  route: RouteCapsule;
};

export type ExpiredTicketAction = {
  expired: true;
};

export type ResolveTicketActionResult =
  | ResolvedTicketAction
  | ExpiredTicketAction;

export const isExpiredTicketAction = (
  value: ResolveTicketActionResult | null
): value is ExpiredTicketAction =>
  value !== null && "expired" in value && value.expired === true;

const isRouteCapsule = (value: RouteCapsule): boolean =>
  !!value.senderRouteTag &&
  !!value.recipientRouteTag &&
  !!value.pairTag &&
  !!value.reportSeeds?.senderAbuseSeed &&
  !!value.reportSeeds?.pairAbuseSeed &&
  typeof value.replyPolicy?.canReply === "boolean";

export const resolveTicketAction = async (
  ctx: Context,
  env: Environment,
  action: TicketAction,
  ticketRef: string,
  actorHash?: string
): Promise<ResolveTicketActionResult | null> => {
  const from = ctx.from;
  if (!from || !isCallbackRef(ticketRef)) {
    return null;
  }

  const resolvedActorHash =
    actorHash ?? (await hmacTelegramUserId(env.APP_HMAC_PEPPER, from.id));
  const ticketHash = await createTicketHash(env.APP_HMAC_PEPPER, ticketRef);
  const ownerProofCandidate = await createOwnerProofTag(
    env.APP_HMAC_PEPPER,
    resolvedActorHash,
    ticketHash
  );

  let ticket;
  try {
    ticket = await getTicketRecord(env, ticketHash);
  } catch (error) {
    if (error instanceof TicketExpiredError) {
      return { expired: true };
    }
    throw error;
  }
  if (!ticket) {
    return null;
  }

  if (!constantTimeEqual(ownerProofCandidate, ticket.ownerProofTag)) {
    return null;
  }

  if (!ticket.routeEnc) {
    return { expired: true };
  }

  const ticketKey = await deriveTicketKey(env.APP_MASTER_KEY, ticketHash);
  const route = await decryptEnvelope<RouteCapsule>(
    ticketKey,
    ticket.routeEnc,
    routeAad(ticketHash)
  );

  if (!isRouteCapsule(route)) {
    return null;
  }

  return {
    action,
    ticketRef,
    ticketHash,
    actorHash: resolvedActorHash,
    ticket,
    ticketKey,
    route,
  };
};
