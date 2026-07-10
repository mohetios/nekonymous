import type { Context } from "grammy";
import type { Environment } from "../../types";
import { renderScreen } from "../../bot/render-screen";
import { ASSESSMENT_BUTTON } from "../../i18n/labels";
import { MENU } from "../../bot/menu";
import {
  MATCH_HUB_STATUS,
  formatSuggestionHubMessage,
} from "../../i18n/matching";
import { getAssessmentSession } from "../../storage/user-state-client";
import { getLatestAssessmentProfile } from "../assessment/assessment-profile-service";
import {
  expireOldMatchRequests,
  getMatchDashboard,
  resolveMatchHubMenuOptions,
} from "./match-service";
import { listPendingMatchRequests } from "./match-request-service";
import { buildSuggestionHubKeyboard } from "./keyboards";
import { convertToPersianNumbers } from "../../utils/tools";

const assessmentStatusLine = (
  hasProfile: boolean,
  hasSession: boolean
): string => {
  if (hasSession) {
    return MATCH_HUB_STATUS.assessmentInProgress;
  }
  if (hasProfile) {
    return MATCH_HUB_STATUS.assessmentCompleted;
  }
  return MATCH_HUB_STATUS.assessmentNotStarted;
};

const discoverabilityStatusLine = (
  discoverable: boolean,
  hasProfile: boolean
): string => {
  if (!hasProfile) {
    return MATCH_HUB_STATUS.discoverabilityNeedsAssessment;
  }
  return discoverable
    ? MATCH_HUB_STATUS.discoverabilityActive
    : MATCH_HUB_STATUS.discoverabilityInactive;
};

const eligibilityLineForDashboard = (
  state: Awaited<ReturnType<typeof getMatchDashboard>>["state"]
): string => {
  switch (state) {
    case "no_profile":
      return MATCH_HUB_STATUS.searchNeedsAssessment;
    case "vector_pending":
      return MATCH_HUB_STATUS.searchVectorPending;
    case "vector_failed":
      return MATCH_HUB_STATUS.searchUnavailable;
    case "opt_in_required":
      return MATCH_HUB_STATUS.searchNeedsOptIn;
    case "ready":
      return MATCH_HUB_STATUS.searchReady;
  }
};

export const renderSuggestionHub = async (
  ctx: Context,
  env: Environment,
  userId: string
): Promise<void> => {
  await expireOldMatchRequests(env);

  const [session, profile, dashboard, menuOptions, pending] = await Promise.all([
    getAssessmentSession(userId, env),
    getLatestAssessmentProfile(userId, env),
    getMatchDashboard(userId, env),
    resolveMatchHubMenuOptions(userId, env),
    listPendingMatchRequests(userId, env),
  ]);

  const matchProfile = profile;
  const pendingCount = pending.incoming.length + pending.outgoing.length;

  const text = formatSuggestionHubMessage({
    assessmentLine: assessmentStatusLine(!!profile, !!session),
    discoverabilityLine: discoverabilityStatusLine(
      dashboard.discoverable,
      profile?.status === "completed"
    ),
    pendingLine:
      pendingCount > 0
        ? MATCH_HUB_STATUS.pendingCount(
            convertToPersianNumbers(String(pendingCount))
          )
        : MATCH_HUB_STATUS.pendingNone,
    eligibilityLine: eligibilityLineForDashboard(dashboard.state),
  });

  const keyboard = buildSuggestionHubKeyboard({
    ...menuOptions,
    showPending: pendingCount > 0,
    assessmentLabel: session
      ? ASSESSMENT_BUTTON.continue
      : matchProfile?.status === "completed"
        ? MENU.matchAssessmentRetry
        : MENU.matchAssessment,
  });

  await renderScreen(ctx, { text, replyMarkup: keyboard });
};
