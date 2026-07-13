import type { Context } from "grammy";
import type { Environment } from "../../contracts/runtime";
import { decryptEnvelope } from "./envelope";
import {
  createOwnerProofTag,
  createTicketHash,
  deriveTicketKeys,
  routeAad,
} from "./keys";
import { constantTimeEqual } from "./hmac";
import { hmacTelegramUserId } from "./ticketing-service";
import {
  getTicketRecord,
  TicketExpiredError,
} from "../../storage/ticket-vault/ticket-vault.client";
import type { RouteCapsule } from "../../contracts/ticketing/model";
import { parseTicketCapability } from "./ticket-capability";
import type {
  ExpiredTicketAction,
  ResolveTicketActionResult,
  TicketActionKind,
} from "../../contracts/ticketing/actions";

export const isExpiredTicketAction = (
  value: ResolveTicketActionResult | null
): value is ExpiredTicketAction =>
  value !== null && "expired" in value && value.expired === true;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isRouteCapsule = (value: unknown): value is RouteCapsule => {
  if (!isRecord(value)) {
    return false;
  }
  const replyPolicy = value.replyPolicy;
  return (
    typeof value.senderChatRoute === "string" &&
    typeof value.replyRouteTag === "string" &&
    typeof value.contactTag === "string" &&
    typeof value.blockTag === "string" &&
    typeof value.abuseSubjectTag === "string" &&
    isRecord(replyPolicy) &&
    typeof replyPolicy.canReply === "boolean" &&
    typeof replyPolicy.maxChars === "number"
  );
};

export const resolveTicketAction = async (
  ctx: Context | null,
  env: Environment,
  action: TicketActionKind,
  ticketRef: string,
  actor?: { actorHash?: string; actorUserId?: string }
): Promise<ResolveTicketActionResult | null> => {
  const from = ctx?.from;

  let capability;
  try {
    capability = parseTicketCapability(ticketRef);
  } catch {
    return null;
  }

  const actorUserId = actor?.actorUserId;
  if (!actorUserId) {
    return null;
  }
  const resolvedActorHash =
    actor?.actorHash ??
    (from ? await hmacTelegramUserId(env.APP_HMAC_PEPPER, from.id) : null);
  if (!resolvedActorHash) {
    return null;
  }
  const ticketHash = await createTicketHash(env.APP_HMAC_PEPPER, capability);

  const ownerProofCandidate = await createOwnerProofTag(
    env.APP_HMAC_PEPPER,
    resolvedActorHash,
    actorUserId,
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

  const keys = await deriveTicketKeys(env.APP_MASTER_KEY, ticketHash, capability);
  const route = await decryptEnvelope<unknown>(
    keys.routeKey,
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
    actorUserId,
    ticket,
    routeKey: keys.routeKey,
    payloadKey: keys.payloadKey,
    metaKey: keys.metaKey,
    route,
  };
};
