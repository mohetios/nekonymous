import type { Environment } from "../../contracts/runtime";
import { shardNameForLookupHash } from "../shard-routing";
import type {
  ClaimRequestAcceptResult,
  ConversationRequestTicketRecord,
  RequestTicketStatus,
  SetRequestStatusResult,
  StoreRequestInput,
  StoreSuggestionInput,
  ConversationSuggestionTicketRecord,
  SuggestionTicketStatus,
} from "../../contracts/conversation/vault";

const stub = (env: Environment, lookupHash: string) =>
  env.CONVERSATION_VAULT_DO.get(
    env.CONVERSATION_VAULT_DO.idFromName(
      shardNameForLookupHash("conversation", lookupHash)
    )
  );

export const storeSuggestionRecord = async (
  env: Environment,
  input: StoreSuggestionInput
): Promise<void> => {
  await stub(env, input.suggestionHash).storeSuggestion(input);
};

export const getSuggestionRecord = async (
  env: Environment,
  suggestionHash: string
): Promise<ConversationSuggestionTicketRecord | null> =>
  stub(env, suggestionHash).getSuggestion(suggestionHash);

export const setSuggestionStatus = async (
  env: Environment,
  suggestionHash: string,
  status: SuggestionTicketStatus,
  expectedStatus?: SuggestionTicketStatus
): Promise<void> => {
  const result = await stub(env, suggestionHash).setSuggestionStatus(
    suggestionHash,
    status,
    expectedStatus
  );
  if (!result.ok) {
    throw new Error(`ConversationVaultDO setSuggestionStatus ${result.error}`);
  }
};

export const storeRequestRecord = async (
  env: Environment,
  input: StoreRequestInput
): Promise<void> => {
  await stub(env, input.requestHash).storeRequest(input);
};

export const getRequestRecord = async (
  env: Environment,
  requestHash: string
): Promise<ConversationRequestTicketRecord | null> =>
  stub(env, requestHash).getRequest(requestHash);

export const setRequestStatus = async (
  env: Environment,
  requestHash: string,
  status: RequestTicketStatus,
  expectedStatus?: RequestTicketStatus,
  clearIntro = false
): Promise<void> => {
  const result = await stub(env, requestHash).setRequestStatus(
    requestHash,
    status,
    expectedStatus,
    clearIntro
  );
  if (!result.ok) {
    throw new Error(`ConversationVaultDO setRequestStatus ${result.error}`);
  }
};

export const claimRequestAccept = async (
  env: Environment,
  requestHash: string,
  operationId: string,
  leaseMs?: number
): Promise<ClaimRequestAcceptResult> =>
  stub(env, requestHash).claimRequestAccept(requestHash, operationId, leaseMs);

export const completeRequestAccept = async (
  env: Environment,
  requestHash: string,
  operationId: string,
  acceptedTicketHash: string
): Promise<void> => {
  const result = await stub(env, requestHash).completeRequestAccept(
    requestHash,
    operationId,
    acceptedTicketHash
  );
  if (!result.ok) {
    throw new Error(`ConversationVaultDO completeRequestAccept ${result.error}`);
  }
};

export const failRequestAccept = async (
  env: Environment,
  requestHash: string,
  operationId: string
): Promise<SetRequestStatusResult> =>
  stub(env, requestHash).failRequestAccept(requestHash, operationId);
