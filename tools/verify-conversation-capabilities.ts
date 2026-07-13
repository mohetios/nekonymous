/**
 * Conversation capability resolver smoke tests.
 * Run: pnpm test:conversation-capabilities
 */

import { encryptEnvelope } from "../src/features/ticketing/envelope.ts";
import {
  CapabilityExpiredError,
  CapabilityInvalidError,
  CapabilityProofError,
  INDEX_JOB_CAPABILITY_TTL_MS,
  REQUEST_CAPABILITY_TTL_MS,
  SUGGESTION_CAPABILITY_TTL_MS,
  type ProfileIndexJobRecord,
  type ProfileVaultRecord,
  type ConversationRequestTicketRecord,
  type ConversationSuggestionTicketRecord,
  type ProfileVectorRouteRecord,
} from "../src/features/ticketing/conversation-capabilities.ts";
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
  randomIndexJobRef,
  randomProfileRef,
  randomRequestRef,
  randomSuggestionRef,
  randomVectorRef,
  requestIntroAad,
  requestRouteAad,
  suggestionExplanationAad,
  suggestionRouteAad,
  vectorRouteAad,
} from "../src/features/ticketing/conversation-keys.ts";
import {
  resolveIndexJobCapability,
  resolveProfileCapability,
  resolveRequestCapability,
  resolveSuggestionCapability,
  resolveVectorRoute,
} from "../src/features/ticketing/conversation-resolvers.ts";
import { hmacTelegramUserId } from "../src/features/ticketing/ticketing-service.ts";

const appMasterKey = "test-app-master-key-local-32bytes!";
const pepper = "test-hmac-pepper-local-32bytes!!";
const now = Date.now();

const actorHash = await hmacTelegramUserId(pepper, 101);
const otherActorHash = await hmacTelegramUserId(pepper, 102);

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const expectThrows = async (
  label: string,
  run: () => Promise<unknown>,
  errorType: new (...args: never[]) => Error
): Promise<void> => {
  try {
    await run();
    fail(`${label}: expected ${errorType.name}`);
  } catch (error) {
    if (!(error instanceof errorType)) {
      fail(`${label}: got ${error instanceof Error ? error.name : typeof error}`);
    }
  }
};

const profileRef = randomProfileRef();
const profileHash = await createProfileLookupHash(appMasterKey, profileRef);
if (profileHash.includes(profileRef)) {
  fail("profile lookup hash must not embed raw profileRef");
}

const profileRouteKey = await deriveProfileRouteKey(appMasterKey, profileHash);
const profileRouteEnc = await encryptEnvelope(
  profileRouteKey,
  JSON.stringify({ revision: 1 }),
  profileRouteAad(profileHash)
);
const profileRecord: ProfileVaultRecord = {
  profileHash,
  ownerProofTag: await createConversationOwnerProofTag(
    appMasterKey,
    actorHash,
    profileHash
  ),
  profileEnc: "{}",
  routeEnc: profileRouteEnc,
  revision: 1,
  status: "private",
  createdAt: now,
  updatedAt: now,
};

const profileResolved = await resolveProfileCapability(
  appMasterKey,
  { profileRef, actorHash, decryptRoute: true },
  async () => profileRecord
);
if (profileResolved.route?.revision !== 1) {
  fail("profile route decrypt failed");
}

await expectThrows(
  "profile wrong actor",
  () =>
    resolveProfileCapability(
      appMasterKey,
      { profileRef, actorHash: otherActorHash },
      async () => profileRecord
    ),
  CapabilityProofError
);

await expectThrows(
  "profile invalid ref",
  () =>
    resolveProfileCapability(
      appMasterKey,
      { profileRef: "bad", actorHash },
      async () => profileRecord
    ),
  CapabilityInvalidError
);

const vectorRef = randomVectorRef();
const vectorHash = await createVectorLookupHash(appMasterKey, vectorRef);
const vectorRouteKey = await deriveVectorRouteKey(appMasterKey, vectorHash);
const vectorRouteEnc = await encryptEnvelope(
  vectorRouteKey,
  JSON.stringify({
    revision: 1,
    vectorizeId: "vec-random-id",
    role: "self",
  }),
  vectorRouteAad(vectorHash)
);
const vectorRecord: ProfileVectorRouteRecord = {
  vectorHash,
  vectorRouteEnc,
  role: "self",
  revision: 1,
  status: "active",
  createdAt: now,
  updatedAt: now,
};

const vectorResolved = await resolveVectorRoute(
  appMasterKey,
  { vectorRef, decryptRoute: true },
  async () => vectorRecord
);
if (vectorResolved.route?.vectorizeId !== "vec-random-id") {
  fail("vector route decrypt failed");
}

const indexJobRef = randomIndexJobRef();
const jobHash = await createIndexJobLookupHash(appMasterKey, indexJobRef);
const indexJobRouteKey = await deriveIndexJobRouteKey(appMasterKey, jobHash);
const indexJobRouteEnc = await encryptEnvelope(
  indexJobRouteKey,
  JSON.stringify({ revision: 1, profileHash }),
  indexJobRouteAad(jobHash)
);
const indexJobRecord: ProfileIndexJobRecord = {
  jobHash,
  routeEnc: indexJobRouteEnc,
  revision: 1,
  status: "pending",
  createdAt: now,
  expiresAt: now + INDEX_JOB_CAPABILITY_TTL_MS,
};

const indexResolved = await resolveIndexJobCapability(
  appMasterKey,
  { indexJobRef, decryptRoute: true },
  async () => indexJobRecord
);
if (indexResolved.route?.profileHash !== profileHash) {
  fail("index job route decrypt failed");
}

const expiredIndexJob: ProfileIndexJobRecord = {
  ...indexJobRecord,
  expiresAt: now - 1,
};
await expectThrows(
  "index job expired",
  () =>
    resolveIndexJobCapability(appMasterKey, { indexJobRef }, async () => expiredIndexJob),
  CapabilityExpiredError
);

const suggestionRef = randomSuggestionRef();
const suggestionHash = await createSuggestionLookupHash(appMasterKey, suggestionRef);
const suggestionRouteKey = await deriveSuggestionRouteKey(appMasterKey, suggestionHash);
const suggestionRouteEnc = await encryptEnvelope(
  suggestionRouteKey,
  JSON.stringify({ candidateProfileHash: profileHash }),
  suggestionRouteAad(suggestionHash)
);
const suggestionExplanationKey = await deriveSuggestionExplanationKey(
  appMasterKey,
  suggestionHash
);
const explanationEnc = await encryptEnvelope(
  suggestionExplanationKey,
  JSON.stringify("چرا این گزینه"),
  suggestionExplanationAad(suggestionHash)
);
const suggestionRecord: ConversationSuggestionTicketRecord = {
  suggestionHash,
  requesterProofTag: await createConversationOwnerProofTag(
    appMasterKey,
    actorHash,
    suggestionHash
  ),
  candidateRouteEnc: suggestionRouteEnc,
  pairTag: "pair-tag-blind",
  explanationEnc,
  status: "created",
  createdAt: now,
  expiresAt: now + SUGGESTION_CAPABILITY_TTL_MS,
};

const suggestionResolved = await resolveSuggestionCapability(
  appMasterKey,
  {
    suggestionRef,
    actorHash,
    decryptRoute: true,
    decryptExplanation: true,
  },
  async () => suggestionRecord
);
if (suggestionResolved.explanation !== "چرا این گزینه") {
  fail("suggestion explanation decrypt failed");
}

const requestRef = randomRequestRef();
const requestHash = await createRequestLookupHash(appMasterKey, requestRef);
const requestRouteKey = await deriveRequestRouteKey(appMasterKey, requestHash);
const requestRouteEnc = await encryptEnvelope(
  requestRouteKey,
  JSON.stringify({
    requesterProfileHash: profileHash,
    candidateProfileHash: "other-profile-hash",
    requesterUserId: "user-requester",
    pairTag: "pair-tag-blind",
  }),
  requestRouteAad(requestHash)
);
const requestIntroKey = await deriveRequestIntroKey(appMasterKey, requestHash);
const introEnc = await encryptEnvelope(
  requestIntroKey,
  JSON.stringify("سلام"),
  requestIntroAad(requestHash)
);
const requestRecord: ConversationRequestTicketRecord = {
  requestHash,
  requesterProofTag: await createConversationOwnerProofTag(
    appMasterKey,
    actorHash,
    requestHash
  ),
  candidateProofTag: await createConversationOwnerProofTag(
    appMasterKey,
    "other-profile-hash",
    requestHash
  ),
  requesterRouteEnc: requestRouteEnc,
  candidateRouteEnc: "{}",
  introEnc,
  status: "pending",
  createdAt: now,
  expiresAt: now + REQUEST_CAPABILITY_TTL_MS,
};

const requestResolved = await resolveRequestCapability(
  appMasterKey,
  {
    requestRef,
    actorHash,
    decryptRoute: true,
    decryptIntro: true,
  },
  async () => requestRecord
);
if (requestResolved.intro !== "سلام") {
  fail("request intro decrypt failed");
}

const expiredRequest: ConversationRequestTicketRecord = {
  ...requestRecord,
  expiresAt: now - 1,
};
await expectThrows(
  "request expired",
  () =>
    resolveRequestCapability(appMasterKey, { requestRef, actorHash }, async () => expiredRequest),
  CapabilityExpiredError
);

console.log("verify-conversation-capabilities: ok");
