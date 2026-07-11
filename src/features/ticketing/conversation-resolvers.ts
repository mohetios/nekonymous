import { constantTimeEqual } from "./hmac.ts";
import { decryptEnvelope } from "./envelope.ts";
import {
  assertCapabilityRef,
  CapabilityExpiredError,
  CapabilityProofError,
  CapabilityStateError,
  activeProfileStatuses,
  isExpiredAt,
  terminalRequestStatuses,
  terminalSuggestionStatuses,
  type IndexJobRecord,
  type IndexJobRouteCapsule,
  type ProfileRouteCapsule,
  type ProfileVaultRecord,
  type RequestRouteCapsule,
  type RequestTicketRecord,
  type SuggestionRouteCapsule,
  type SuggestionTicketRecord,
  type VectorRouteCapsule,
  type VectorRouteRecord,
} from "./conversation-capabilities.ts";
import {
  createConversationOwnerProofTag,
  createIndexJobLookupHash,
  createProfileLookupHash,
  createRequestLookupHash,
  createSuggestionLookupHash,
  createVectorLookupHash,
  deriveIndexJobRouteKey,
  deriveProfileRouteKey,
  deriveRequestIntroKey,
  deriveRequestRouteKey,
  deriveSuggestionExplanationKey,
  deriveSuggestionRouteKey,
  deriveVectorRouteKey,
  indexJobRouteAad,
  profileRouteAad,
  requestIntroAad,
  requestRouteAad,
  suggestionExplanationAad,
  suggestionRouteAad,
  vectorRouteAad,
  type IndexJobRef,
  type ProfileRef,
  type RequestRef,
  type SuggestionRef,
  type VectorRef,
} from "./conversation-keys.ts";

export type ResolveProfileInput = {
  profileRef: ProfileRef;
  actorHash: string;
  decryptRoute?: boolean;
};

export type ResolvedProfileCapability = {
  profileHash: string;
  revision: number;
  status: ProfileVaultRecord["status"];
  route?: ProfileRouteCapsule;
};

export type ResolveVectorInput = {
  vectorRef: VectorRef;
  decryptRoute?: boolean;
};

export type ResolvedVectorRoute = {
  vectorHash: string;
  revision: number;
  role: VectorRouteRecord["role"];
  status: VectorRouteRecord["status"];
  route?: VectorRouteCapsule;
};

export type ResolveIndexJobInput = {
  indexJobRef: IndexJobRef;
  decryptRoute?: boolean;
};

export type ResolvedIndexJob = {
  jobHash: string;
  revision: number;
  status: IndexJobRecord["status"];
  route?: IndexJobRouteCapsule;
};

export type ResolveSuggestionInput = {
  suggestionRef: SuggestionRef;
  actorHash: string;
  decryptRoute?: boolean;
  decryptExplanation?: boolean;
};

export type ResolvedSuggestionCapability = {
  suggestionHash: string;
  pairTag: string;
  status: SuggestionTicketRecord["status"];
  route?: SuggestionRouteCapsule;
  explanation?: string;
};

export type ResolveRequestInput = {
  requestRef: RequestRef;
  actorHash: string;
  decryptRoute?: boolean;
  decryptIntro?: boolean;
};

export type ResolvedRequestCapability = {
  requestHash: string;
  status: RequestTicketRecord["status"];
  route?: RequestRouteCapsule;
  intro?: string;
};

const verifyOwnerProof = async (
  appMasterKey: string,
  actorHash: string,
  recordHash: string,
  ownerProofTag: string
): Promise<void> => {
  const expected = await createConversationOwnerProofTag(
    appMasterKey,
    actorHash,
    recordHash
  );
  if (!constantTimeEqual(expected, ownerProofTag)) {
    throw new CapabilityProofError();
  }
};

export const resolveProfileCapability = async (
  appMasterKey: string,
  input: ResolveProfileInput,
  loadRecord: (lookupHash: string) => Promise<ProfileVaultRecord | null>
): Promise<ResolvedProfileCapability> => {
  const profileRef = assertCapabilityRef(input.profileRef, "profileRef");
  const profileHash = await createProfileLookupHash(appMasterKey, profileRef);
  const record = await loadRecord(profileHash);
  if (!record || record.profileHash !== profileHash) {
    throw new CapabilityStateError("Profile record missing");
  }

  await verifyOwnerProof(
    appMasterKey,
    input.actorHash,
    profileHash,
    record.ownerProofTag
  );

  if (!activeProfileStatuses.has(record.status)) {
    throw new CapabilityStateError(`Profile status ${record.status}`);
  }

  const resolved: ResolvedProfileCapability = {
    profileHash,
    revision: record.revision,
    status: record.status,
  };

  if (input.decryptRoute) {
    const key = await deriveProfileRouteKey(appMasterKey, profileHash);
    resolved.route = await decryptEnvelope<ProfileRouteCapsule>(
      key,
      record.routeEnc,
      profileRouteAad(profileHash)
    );
  }

  return resolved;
};

export const resolveVectorRoute = async (
  appMasterKey: string,
  input: ResolveVectorInput,
  loadRecord: (lookupHash: string) => Promise<VectorRouteRecord | null>
): Promise<ResolvedVectorRoute> => {
  const vectorRef = assertCapabilityRef(input.vectorRef, "vectorRef");
  const vectorHash = await createVectorLookupHash(appMasterKey, vectorRef);
  const record = await loadRecord(vectorHash);
  if (!record || record.vectorHash !== vectorHash) {
    throw new CapabilityStateError("Vector route missing");
  }

  if (record.status === "deleted") {
    throw new CapabilityStateError("Vector route deleted");
  }

  const resolved: ResolvedVectorRoute = {
    vectorHash,
    revision: record.revision,
    role: record.role,
    status: record.status,
  };

  if (input.decryptRoute) {
    const key = await deriveVectorRouteKey(appMasterKey, vectorHash);
    resolved.route = await decryptEnvelope<VectorRouteCapsule>(
      key,
      record.vectorRouteEnc,
      vectorRouteAad(vectorHash)
    );
  }

  return resolved;
};

export const resolveIndexJobCapability = async (
  appMasterKey: string,
  input: ResolveIndexJobInput,
  loadRecord: (lookupHash: string) => Promise<IndexJobRecord | null>
): Promise<ResolvedIndexJob> => {
  const indexJobRef = assertCapabilityRef(input.indexJobRef, "indexJobRef");
  const jobHash = await createIndexJobLookupHash(appMasterKey, indexJobRef);
  const record = await loadRecord(jobHash);
  if (!record || record.jobHash !== jobHash) {
    throw new CapabilityStateError("Index job missing");
  }

  if (isExpiredAt(record.expiresAt) || record.status === "expired") {
    throw new CapabilityExpiredError();
  }

  if (record.status === "completed") {
    throw new CapabilityStateError("Index job already consumed");
  }

  const resolved: ResolvedIndexJob = {
    jobHash,
    revision: record.revision,
    status: record.status,
  };

  if (input.decryptRoute) {
    const key = await deriveIndexJobRouteKey(appMasterKey, jobHash);
    resolved.route = await decryptEnvelope<IndexJobRouteCapsule>(
      key,
      record.routeEnc,
      indexJobRouteAad(jobHash)
    );
  }

  return resolved;
};

export const resolveSuggestionCapability = async (
  appMasterKey: string,
  input: ResolveSuggestionInput,
  loadRecord: (lookupHash: string) => Promise<SuggestionTicketRecord | null>
): Promise<ResolvedSuggestionCapability> => {
  const suggestionRef = assertCapabilityRef(input.suggestionRef, "suggestionRef");
  const suggestionHash = await createSuggestionLookupHash(
    appMasterKey,
    suggestionRef
  );
  const record = await loadRecord(suggestionHash);
  if (!record || record.suggestionHash !== suggestionHash) {
    throw new CapabilityStateError("Suggestion ticket missing");
  }

  await verifyOwnerProof(
    appMasterKey,
    input.actorHash,
    suggestionHash,
    record.requesterProofTag
  );

  if (isExpiredAt(record.expiresAt) || record.status === "expired") {
    throw new CapabilityExpiredError();
  }

  if (terminalSuggestionStatuses.has(record.status)) {
    throw new CapabilityStateError(`Suggestion status ${record.status}`);
  }

  const resolved: ResolvedSuggestionCapability = {
    suggestionHash,
    pairTag: record.pairTag,
    status: record.status,
  };

  if (input.decryptRoute) {
    const key = await deriveSuggestionRouteKey(appMasterKey, suggestionHash);
    resolved.route = await decryptEnvelope<SuggestionRouteCapsule>(
      key,
      record.candidateRouteEnc,
      suggestionRouteAad(suggestionHash)
    );
  }

  if (input.decryptExplanation) {
    const key = await deriveSuggestionExplanationKey(appMasterKey, suggestionHash);
    resolved.explanation = await decryptEnvelope<string>(
      key,
      record.explanationEnc,
      suggestionExplanationAad(suggestionHash)
    );
  }

  return resolved;
};

export const resolveRequestCapability = async (
  appMasterKey: string,
  input: ResolveRequestInput,
  loadRecord: (lookupHash: string) => Promise<RequestTicketRecord | null>
): Promise<ResolvedRequestCapability> => {
  const requestRef = assertCapabilityRef(input.requestRef, "requestRef");
  const requestHash = await createRequestLookupHash(appMasterKey, requestRef);
  const record = await loadRecord(requestHash);
  if (!record || record.requestHash !== requestHash) {
    throw new CapabilityStateError("Request ticket missing");
  }

  await verifyOwnerProof(
    appMasterKey,
    input.actorHash,
    requestHash,
    record.requesterProofTag
  );

  if (isExpiredAt(record.expiresAt) || record.status === "expired") {
    throw new CapabilityExpiredError();
  }

  if (terminalRequestStatuses.has(record.status)) {
    throw new CapabilityStateError(`Request status ${record.status}`);
  }

  const resolved: ResolvedRequestCapability = {
    requestHash,
    status: record.status,
  };

  if (input.decryptRoute) {
    const key = await deriveRequestRouteKey(appMasterKey, requestHash);
    resolved.route = await decryptEnvelope<RequestRouteCapsule>(
      key,
      record.requesterRouteEnc,
      requestRouteAad(requestHash)
    );
  }

  if (input.decryptIntro && record.introEnc) {
    const key = await deriveRequestIntroKey(appMasterKey, requestHash);
    resolved.intro = await decryptEnvelope<string>(
      key,
      record.introEnc,
      requestIntroAad(requestHash)
    );
  }

  return resolved;
};

export const resolveRequestForCandidate = async (
  appMasterKey: string,
  input: ResolveRequestInput,
  loadRecord: (lookupHash: string) => Promise<RequestTicketRecord | null>,
  loadProfile: (profileHash: string) => Promise<ProfileVaultRecord | null>
): Promise<ResolvedRequestCapability> => {
  const requestRef = assertCapabilityRef(input.requestRef, "requestRef");
  const requestHash = await createRequestLookupHash(appMasterKey, requestRef);
  const record = await loadRecord(requestHash);
  if (!record || record.requestHash !== requestHash) {
    throw new CapabilityStateError("Request ticket missing");
  }

  if (isExpiredAt(record.expiresAt) || record.status === "expired") {
    throw new CapabilityExpiredError();
  }

  if (terminalRequestStatuses.has(record.status)) {
    throw new CapabilityStateError(`Request status ${record.status}`);
  }

  const routeKey = await deriveRequestRouteKey(appMasterKey, requestHash);
  const route = await decryptEnvelope<RequestRouteCapsule>(
    routeKey,
    record.requesterRouteEnc,
    requestRouteAad(requestHash)
  );

  const expectedCandidateProof = await createConversationOwnerProofTag(
    appMasterKey,
    route.candidateProfileHash,
    requestHash
  );
  if (!constantTimeEqual(expectedCandidateProof, record.candidateProofTag)) {
    throw new CapabilityProofError();
  }

  const profileRecord = await loadProfile(route.candidateProfileHash);
  if (!profileRecord) {
    throw new CapabilityStateError("Candidate profile missing");
  }

  const expectedOwnerProof = await createConversationOwnerProofTag(
    appMasterKey,
    input.actorHash,
    route.candidateProfileHash
  );
  if (!constantTimeEqual(expectedOwnerProof, profileRecord.ownerProofTag)) {
    throw new CapabilityProofError();
  }

  const resolved: ResolvedRequestCapability = {
    requestHash,
    status: record.status,
    route,
  };

  if (input.decryptIntro && record.introEnc) {
    const key = await deriveRequestIntroKey(appMasterKey, requestHash);
    resolved.intro = await decryptEnvelope<string>(
      key,
      record.introEnc,
      requestIntroAad(requestHash)
    );
  }

  return resolved;
};
