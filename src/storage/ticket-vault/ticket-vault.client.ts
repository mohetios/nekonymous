import type { Environment } from "../../types";
import type {
  StoreTicketInput,
  TicketTransitionStatus,
  TicketVaultRecord,
} from "./ticket-vault.types";

export class TicketExpiredError extends Error {
  constructor() {
    super("Ticket expired");
    this.name = "TicketExpiredError";
  }
}

const shardName = (ticketHash: string): string =>
  `ticket:${ticketHash.slice(0, 2)}`;

const stub = (env: Environment, ticketHash: string) =>
  env.TICKET_VAULT.get(env.TICKET_VAULT.idFromName(shardName(ticketHash)));

export const storeTicket = async (
  env: Environment,
  input: StoreTicketInput
): Promise<void> => {
  const result = await stub(env, input.ticketHash).storeTicket(input);
  if (!result.ok && !result.duplicate) {
    throw new Error("TicketVaultDO storeTicket rejected input");
  }
};

export const getTicketRecord = async (
  env: Environment,
  ticketHash: string
): Promise<TicketVaultRecord | null> => {
  const result = await stub(env, ticketHash).getTicket(ticketHash);
  if (result.status === "not_found") {
    return null;
  }
  if (result.status === "expired") {
    throw new TicketExpiredError();
  }
  return result.record;
};

const markTicketStatus = async (
  env: Environment,
  ticketHash: string,
  status: TicketTransitionStatus
): Promise<void> => {
  await stub(env, ticketHash).markStatus(ticketHash, status);
};

export const markTicketViewed = (env: Environment, ticketHash: string) =>
  markTicketStatus(env, ticketHash, "viewed");

export const markTicketReplied = (env: Environment, ticketHash: string) =>
  markTicketStatus(env, ticketHash, "replied");

export const markTicketBlocked = (env: Environment, ticketHash: string) =>
  markTicketStatus(env, ticketHash, "blocked");

export const markTicketRecordReported = async (
  env: Environment,
  ticketHash: string
): Promise<void> => {
  await markTicketStatus(env, ticketHash, "reported");
};

export const expireTicketRecord = async (
  env: Environment,
  ticketHash: string
): Promise<void> => {
  await stub(env, ticketHash).expireTicket(ticketHash);
};

export const deleteTicketRecord = async (
  env: Environment,
  ticketHash: string
): Promise<void> => {
  await stub(env, ticketHash).deleteTicket(ticketHash);
};
