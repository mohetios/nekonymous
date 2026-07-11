import type { Environment } from "../../types";
import { shardNameForLookupHash } from "../shard-routing";
import type {
  ConversationVaultShardPing,
  RequestTicketRecord,
  RequestTicketStatus,
  StoreRequestInput,
  StoreSuggestionInput,
  SuggestionTicketRecord,
  SuggestionTicketStatus,
} from "./conversation-vault.types";

const stub = (env: Environment, lookupHash: string) =>
  env.CONVERSATION_VAULT_DO.get(
    env.CONVERSATION_VAULT_DO.idFromName(
      shardNameForLookupHash("conversation", lookupHash)
    )
  );

const doFetch = async <T>(
  env: Environment,
  lookupHash: string,
  path: string,
  init?: RequestInit
): Promise<T> => {
  const response = await stub(env, lookupHash).fetch(
    `https://conversation-vault${path}`,
    init
  );
  if (!response.ok) {
    throw new Error(`ConversationVaultDO ${path} failed: ${response.status}`);
  }
  return response.json<T>();
};

export const pingConversationVaultShard = async (
  env: Environment,
  lookupHash: string
): Promise<ConversationVaultShardPing> => {
  const shard = stub(env, lookupHash);
  return shard.ping();
};

export const storeSuggestionRecord = async (
  env: Environment,
  input: StoreSuggestionInput
): Promise<void> => {
  await doFetch(env, input.suggestionHash, "/suggestions", {
    method: "POST",
    body: JSON.stringify(input),
  });
};

export const getSuggestionRecord = async (
  env: Environment,
  suggestionHash: string
): Promise<SuggestionTicketRecord | null> => {
  const body = await doFetch<{ record: SuggestionTicketRecord | null }>(
    env,
    suggestionHash,
    `/suggestions/${encodeURIComponent(suggestionHash)}`
  );
  return body.record;
};

export const setSuggestionStatus = async (
  env: Environment,
  suggestionHash: string,
  status: SuggestionTicketStatus,
  expectedStatus?: SuggestionTicketStatus
): Promise<void> => {
  await doFetch(
    env,
    suggestionHash,
    `/suggestions/${encodeURIComponent(suggestionHash)}/status`,
    {
      method: "POST",
      body: JSON.stringify({ status, expectedStatus }),
    }
  );
};

export const storeRequestRecord = async (
  env: Environment,
  input: StoreRequestInput
): Promise<void> => {
  await doFetch(env, input.requestHash, "/requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
};

export const getRequestRecord = async (
  env: Environment,
  requestHash: string
): Promise<RequestTicketRecord | null> => {
  const body = await doFetch<{ record: RequestTicketRecord | null }>(
    env,
    requestHash,
    `/requests/${encodeURIComponent(requestHash)}`
  );
  return body.record;
};

export const setRequestStatus = async (
  env: Environment,
  requestHash: string,
  status: RequestTicketStatus,
  expectedStatus?: RequestTicketStatus,
  clearIntro = false
): Promise<void> => {
  await doFetch(
    env,
    requestHash,
    `/requests/${encodeURIComponent(requestHash)}/status`,
    {
      method: "POST",
      body: JSON.stringify({ status, expectedStatus, clearIntro }),
    }
  );
};
