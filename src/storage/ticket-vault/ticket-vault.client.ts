import type { Environment } from "../../types";
import type { StoreTicketInput, TicketVaultRecord } from "./ticket-vault.types";

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

const doFetch = async <T>(
  env: Environment,
  ticketHash: string,
  path: string,
  init?: RequestInit
): Promise<T> => {
  const response = await stub(env, ticketHash).fetch(
    `https://ticket-vault${path}`,
    init
  );
  if (!response.ok) {
    throw new Error(`TicketVaultDO ${path} failed: ${response.status}`);
  }
  return response.json<T>();
};

export const storeTicket = async (
  env: Environment,
  input: StoreTicketInput
): Promise<void> => {
  await doFetch(env, input.ticketHash, "/tickets", {
    method: "POST",
    body: JSON.stringify(input),
  });
};

export const getTicketRecord = async (
  env: Environment,
  ticketHash: string
): Promise<TicketVaultRecord | null> => {
  const response = await stub(env, ticketHash).fetch(
    `https://ticket-vault/tickets/${encodeURIComponent(ticketHash)}`
  );
  if (response.status === 404) {
    return null;
  }
  if (response.status === 410) {
    throw new TicketExpiredError();
  }
  if (!response.ok) {
    throw new Error(`TicketVaultDO get failed: ${response.status}`);
  }
  return response.json<TicketVaultRecord>();
};

const markTicketStatus = async (
  env: Environment,
  ticketHash: string,
  status: "viewed" | "replied" | "blocked" | "reported"
): Promise<void> => {
  await doFetch(env, ticketHash, `/tickets/${encodeURIComponent(ticketHash)}/mark-${status}`, {
    method: "POST",
  });
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
  await doFetch(env, ticketHash, `/tickets/${encodeURIComponent(ticketHash)}/expire`, {
    method: "POST",
  });
};

export const deleteTicketRecord = async (
  env: Environment,
  ticketHash: string
): Promise<void> => {
  await doFetch(env, ticketHash, `/tickets/${encodeURIComponent(ticketHash)}`, {
    method: "DELETE",
  });
};
