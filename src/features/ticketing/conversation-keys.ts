import { base64UrlToBytes, bytesToBase64Url, randomBase64Url } from "./base64url.ts";
import { deriveAesGcmKey, getHkdfKeyMaterial } from "./hkdf.ts";
import { hmacBase64Url } from "./hmac.ts";

const textEncoder = new TextEncoder();

const CAPABILITY_REF_BYTES = 24;

const LOOKUP_DOMAIN = {
  profile: "conversation-v2:profile-lookup:v1:",
  vector: "conversation-v2:vector-lookup:v1:",
  indexJob: "conversation-v2:index-job-lookup:v1:",
  suggestion: "conversation-v2:suggestion-lookup:v1:",
  request: "conversation-v2:request-lookup:v1:",
} as const;

const OWNER_PROOF_KEY_INFO = textEncoder.encode(
  "nekonymous:conversation-v2:owner-proof-key:v1"
);

const ownerProofSecretCache = new Map<string, string>();

const deriveOwnerProofSecret = async (appMasterKey: string): Promise<string> => {
  const cached = ownerProofSecretCache.get(appMasterKey);
  if (cached) {
    return cached;
  }

  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: OWNER_PROOF_KEY_INFO,
    },
    await getHkdfKeyMaterial(appMasterKey),
    256
  );
  const secret = bytesToBase64Url(new Uint8Array(bits));
  ownerProofSecretCache.set(appMasterKey, secret);
  return secret;
};


const AES_INFO = {
  profile: textEncoder.encode("nekonymous:conversation-v2:profile-enc:v1"),
  profileRoute: textEncoder.encode("nekonymous:conversation-v2:profile-route:v1"),
  vectorRoute: textEncoder.encode("nekonymous:conversation-v2:vector-route:v1"),
  indexJobRoute: textEncoder.encode("nekonymous:conversation-v2:index-job-route:v1"),
  suggestionRoute: textEncoder.encode(
    "nekonymous:conversation-v2:suggestion-route:v1"
  ),
  requestRoute: textEncoder.encode("nekonymous:conversation-v2:request-route:v1"),
  requestIntro: textEncoder.encode("nekonymous:conversation-v2:request-intro:v1"),
  suggestionExplanation: textEncoder.encode(
    "nekonymous:conversation-v2:suggestion-explanation:v1"
  ),
} as const;

const lookupSecretCache = new Map<string, string>();

const deriveLookupSecret = async (
  appMasterKey: string,
  domain: keyof typeof LOOKUP_DOMAIN
): Promise<string> => {
  const cacheKey = `${domain}:${appMasterKey}`;
  const cached = lookupSecretCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: textEncoder.encode(LOOKUP_DOMAIN[domain]),
    },
    await getHkdfKeyMaterial(appMasterKey),
    256
  );
  const secret = bytesToBase64Url(new Uint8Array(bits));
  lookupSecretCache.set(cacheKey, secret);
  return secret;
};

const createLookupHash = async (
  appMasterKey: string,
  domain: keyof typeof LOOKUP_DOMAIN,
  capabilityRef: string
): Promise<string> => {
  const secret = await deriveLookupSecret(appMasterKey, domain);
  return hmacBase64Url(secret, `${LOOKUP_DOMAIN[domain]}${capabilityRef}`);
};

export type ProfileRef = string;
export type VectorRef = string;
export type IndexJobRef = string;
export type SuggestionRef = string;
export type RequestRef = string;
export type PairTag = string;

export const CAPABILITY_REF_MAX_LENGTH = 43;
export const CAPABILITY_REF_MIN_LENGTH = 16;

export const randomProfileRef = (): ProfileRef =>
  randomBase64Url(CAPABILITY_REF_BYTES);

export const randomVectorRef = (): VectorRef =>
  randomBase64Url(CAPABILITY_REF_BYTES);

export const randomIndexJobRef = (): IndexJobRef =>
  randomBase64Url(CAPABILITY_REF_BYTES);

export const randomSuggestionRef = (): SuggestionRef =>
  randomBase64Url(CAPABILITY_REF_BYTES);

export const randomRequestRef = (): RequestRef =>
  randomBase64Url(CAPABILITY_REF_BYTES);

export const isCapabilityRef = (value: string): value is string =>
  typeof value === "string" &&
  value.length >= CAPABILITY_REF_MIN_LENGTH &&
  value.length <= CAPABILITY_REF_MAX_LENGTH &&
  /^[A-Za-z0-9_-]+$/.test(value);

export const createProfileLookupHash = (
  appMasterKey: string,
  profileRef: ProfileRef
): Promise<string> => createLookupHash(appMasterKey, "profile", profileRef);

export const createVectorLookupHash = (
  appMasterKey: string,
  vectorRef: VectorRef
): Promise<string> => createLookupHash(appMasterKey, "vector", vectorRef);

export const createIndexJobLookupHash = (
  appMasterKey: string,
  indexJobRef: IndexJobRef
): Promise<string> => createLookupHash(appMasterKey, "indexJob", indexJobRef);

export const createSuggestionLookupHash = (
  appMasterKey: string,
  suggestionRef: SuggestionRef
): Promise<string> => createLookupHash(appMasterKey, "suggestion", suggestionRef);

export const createRequestLookupHash = (
  appMasterKey: string,
  requestRef: RequestRef
): Promise<string> => createLookupHash(appMasterKey, "request", requestRef);

const PAIR_TAG_KEY_INFO = textEncoder.encode(
  "nekonymous:conversation-v2:pair-tag-key:v1"
);

const EXPOSURE_KEY_INFO = textEncoder.encode(
  "nekonymous:conversation-v2:exposure-token-key:v1"
);

const pairSecretCache = new Map<string, string>();
const exposureSecretCache = new Map<string, string>();

const deriveDomainSecret = async (
  appMasterKey: string,
  info: Uint8Array,
  cache: Map<string, string>
): Promise<string> => {
  const cacheKey = `${bytesToBase64Url(info)}:${appMasterKey}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info,
    },
    await getHkdfKeyMaterial(appMasterKey),
    256
  );
  const secret = bytesToBase64Url(new Uint8Array(bits));
  cache.set(cacheKey, secret);
  return secret;
};

export const createConversationPairTag = async (
  appMasterKey: string,
  firstProfileHash: string,
  secondProfileHash: string
): Promise<PairTag> => {
  const [left, right] = [firstProfileHash, secondProfileHash].sort();
  const secret = await deriveDomainSecret(
    appMasterKey,
    PAIR_TAG_KEY_INFO,
    pairSecretCache
  );
  return hmacBase64Url(secret, `conversation-v2:pair-tag:v1:${left}:${right}`);
};

export const createExposureTokenHash = async (
  appMasterKey: string,
  pairTag: PairTag
): Promise<string> => {
  const secret = await deriveDomainSecret(
    appMasterKey,
    EXPOSURE_KEY_INFO,
    exposureSecretCache
  );
  return hmacBase64Url(secret, `conversation-v2:exposure:v1:${pairTag}`);
};

export const createConversationOwnerProofTag = async (
  appMasterKey: string,
  actorHash: string,
  recordHash: string
): Promise<string> => {
  const secret = await deriveOwnerProofSecret(appMasterKey);
  return hmacBase64Url(
    secret,
    `conversation-v2:owner-proof:v1:${actorHash}:${recordHash}`
  );
};

const deriveRecordKey = (
  appMasterKey: string,
  recordHash: string,
  info: Uint8Array
): Promise<CryptoKey> =>
  deriveAesGcmKey(appMasterKey, base64UrlToBytes(recordHash), info);

export const deriveProfileEncryptionKey = (
  appMasterKey: string,
  profileHash: string
): Promise<CryptoKey> =>
  deriveRecordKey(appMasterKey, profileHash, AES_INFO.profile);

export const deriveProfileRouteKey = (
  appMasterKey: string,
  profileHash: string
): Promise<CryptoKey> =>
  deriveRecordKey(appMasterKey, profileHash, AES_INFO.profileRoute);

export const deriveVectorRouteKey = (
  appMasterKey: string,
  vectorHash: string
): Promise<CryptoKey> =>
  deriveRecordKey(appMasterKey, vectorHash, AES_INFO.vectorRoute);

export const deriveIndexJobRouteKey = (
  appMasterKey: string,
  jobHash: string
): Promise<CryptoKey> =>
  deriveRecordKey(appMasterKey, jobHash, AES_INFO.indexJobRoute);

export const deriveSuggestionRouteKey = (
  appMasterKey: string,
  suggestionHash: string
): Promise<CryptoKey> =>
  deriveRecordKey(appMasterKey, suggestionHash, AES_INFO.suggestionRoute);

export const deriveRequestRouteKey = (
  appMasterKey: string,
  requestHash: string
): Promise<CryptoKey> =>
  deriveRecordKey(appMasterKey, requestHash, AES_INFO.requestRoute);

export const deriveRequestIntroKey = (
  appMasterKey: string,
  requestHash: string
): Promise<CryptoKey> =>
  deriveRecordKey(appMasterKey, requestHash, AES_INFO.requestIntro);

export const deriveSuggestionExplanationKey = (
  appMasterKey: string,
  suggestionHash: string
): Promise<CryptoKey> =>
  deriveRecordKey(appMasterKey, suggestionHash, AES_INFO.suggestionExplanation);

export const profileEncAad = (profileHash: string): string =>
  `conversation-v2:profile:v1:${profileHash}`;

export const profileRouteAad = (profileHash: string): string =>
  `conversation-v2:profile-route:v1:${profileHash}`;

export const vectorRouteAad = (vectorHash: string): string =>
  `conversation-v2:vector-route:v1:${vectorHash}`;

export const indexJobRouteAad = (jobHash: string): string =>
  `conversation-v2:index-job-route:v1:${jobHash}`;

export const indexJobVectorsAad = (jobHash: string): string =>
  `conversation-v2:index-job-vectors:v1:${jobHash}`;

export const suggestionRouteAad = (suggestionHash: string): string =>
  `conversation-v2:suggestion-route:v1:${suggestionHash}`;

export const requestRouteAad = (requestHash: string): string =>
  `conversation-v2:request-route:v1:${requestHash}`;

export const requestIntroAad = (requestHash: string): string =>
  `conversation-v2:request-intro:v1:${requestHash}`;

export const suggestionExplanationAad = (suggestionHash: string): string =>
  `conversation-v2:suggestion-explanation:v1:${suggestionHash}`;
