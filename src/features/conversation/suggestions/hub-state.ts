import type { Environment } from "../../../contracts/runtime";
import {
  getProfileDashboardMeta,
  isProfileSearchReady,
  loadRequesterProfileContext,
} from "../profile/profile-service.ts";
import type { SuggestionHubMenuOptions } from "./types.ts";
import { MATCH_HUB_STATUS } from "../../../i18n/matching.ts";
import { MENU } from "../../../i18n/labels.ts";

export type SuggestionHubView = {
  assessmentLine: string;
  discoverabilityLine: string;
  pendingLine: string;
  eligibilityLine: string;
  keyboard: SuggestionHubMenuOptions & { showPending: boolean };
};

export const buildSuggestionHubView = async (
  env: Environment,
  userId: string
): Promise<SuggestionHubView> => {
  const [meta, profileContext] = await Promise.all([
    getProfileDashboardMeta(env, userId),
    loadRequesterProfileContext(env, userId),
  ]);

  const assessmentLine = meta.hasActiveSession
    ? MATCH_HUB_STATUS.assessmentInProgress
    : meta.hasProfile
      ? MATCH_HUB_STATUS.assessmentCompleted
      : MATCH_HUB_STATUS.assessmentNotStarted;

  let discoverabilityLine: string = MATCH_HUB_STATUS.discoverabilityNeedsAssessment;
  let discoverabilityVariant: SuggestionHubMenuOptions["discoverabilityVariant"] =
    "default";

  if (meta.hasProfile) {
    if (meta.discoverable) {
      discoverabilityLine = MATCH_HUB_STATUS.discoverabilityActive;
      discoverabilityVariant = "can_disable";
    } else if (isProfileSearchReady(profileContext)) {
      discoverabilityLine = MATCH_HUB_STATUS.discoverabilityInactive;
      discoverabilityVariant = "can_enable";
    } else {
      discoverabilityLine = MATCH_HUB_STATUS.discoverabilityInactive;
    }
  }

  const profileVaultStatus = profileContext.ok ? profileContext.vaultStatus : null;

  let eligibilityLine: string = MATCH_HUB_STATUS.searchNeedsAssessment;
  if (isProfileSearchReady(profileContext)) {
    eligibilityLine = MATCH_HUB_STATUS.searchReady;
  } else if (profileVaultStatus === "indexing") {
    eligibilityLine = MATCH_HUB_STATUS.searchVectorPending;
  } else if (profileVaultStatus === "index_failed") {
    eligibilityLine = MATCH_HUB_STATUS.searchUnavailable;
  } else if (!profileContext.ok && profileContext.reason === "profile_failed") {
    eligibilityLine = MATCH_HUB_STATUS.searchUnavailable;
  }

  const showFind = isProfileSearchReady(profileContext);
  const showProfile = profileContext.ok;
  const assessmentLabel = meta.hasProfile
    ? MENU.matchAssessmentRetry
    : MENU.matchAssessment;

  return {
    assessmentLine,
    discoverabilityLine,
    pendingLine: MATCH_HUB_STATUS.pendingNone,
    eligibilityLine,
    keyboard: {
      assessmentLabel,
      showFind,
      showProfile,
      showPending: false,
      discoverabilityVariant,
    },
  };
};
