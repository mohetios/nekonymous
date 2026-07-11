import type { Context } from "grammy";
import type { Environment } from "../../types";
import { mainMenu } from "../../bot/keyboards";
import {
  buildDraftCancelKeyboard,
  draftPlaceholder,
} from "../../bot/input-navigation";
import {
  MATCH_CANDIDATES_HEADER,
  MATCH_CANDIDATES_WHY_FIT,
  MATCH_DISCOVERABILITY_ENABLED,
  MATCH_INTRO_PROMPT,
  MATCH_NO_CANDIDATES,
  MATCH_NO_CANDIDATES_COOLDOWN,
  MATCH_PENDING_EMPTY,
  MATCH_PROFILE_FAILED,
  MATCH_PROFILE_HEADER,
  MATCH_PROFILE_NO_ASSESSMENT,
  MATCH_PROFILE_PRIVACY_NOTE,
  MATCH_RECENT_PAIR_COOLDOWN,
  MATCH_REQUEST_LIMIT,
  MATCH_REQUEST_SENT,
  MATCH_SEARCH_FAILED,
  MATCH_SEARCH_INDEX_PENDING,
  MATCH_SEARCH_LIMIT,
  MATCH_SUGGESTION_INVALID,
} from "../../i18n/matching";
import { HuhMessage } from "../../i18n/messages";
import { hmacTelegramUserId } from "../ticketing/ticketing-service";
import { escapeHtml, withHtml } from "../../utils/tools";
import { logBotError } from "../../utils/logs";
import {
  recordSuggestionSearch,
  recordSuggestionShown,
} from "../../stats/product-events";
import {
  isProfileSearchReady,
  loadRequesterProfileContext,
  setConversationDiscoverability,
} from "../conversation-profile/profile-service";
import { buildProfileSummaryText } from "../conversation-profile/profile-summary.ts";
import { resolveOrCreateUser, getUserById } from "../identity/identity-service";
import { setDraft } from "../../storage/user-state-client";
import { SUGGESTION_HUB_CALLBACK } from "./constants";
import { buildSuggestionCandidateKeyboard } from "./keyboards";
import { renderSuggestionHub } from "./suggestion-hub";
import { searchConversationSuggestions } from "./suggestion-search";
import {
  dismissSuggestionTicket,
  issueSuggestionTickets,
  markSuggestionViewed,
  parseSuggestionCallback,
  recordSuggestionExposure,
  resolveSuggestionRoute,
} from "./suggestion-service";
import { sendProfileDashboard } from "../conversation-profile/profile-handlers";

const INTRO_MAX_CHARS = 500;

const profileUnavailableMessage = (
  reason: "no_profile" | "profile_failed"
): string =>
  reason === "profile_failed"
    ? MATCH_PROFILE_FAILED
    : MATCH_PROFILE_NO_ASSESSMENT;

const searchFailureMessage = (
  reason: "search_limited" | "no_candidates" | "search_failed"
): string => {
  if (reason === "search_limited") {
    return MATCH_SEARCH_LIMIT;
  }
  if (reason === "search_failed") {
    return MATCH_SEARCH_FAILED;
  }
  return MATCH_NO_CANDIDATES_COOLDOWN;
};

const answerCallbackSafely = async (ctx: Context): Promise<void> => {
  try {
    await ctx.answerCallbackQuery();
  } catch {
    // Callback may already be answered or expired.
  }
};

const runSuggestionSearch = async (
  ctx: Context,
  env: Environment,
  userId: string,
  actorHash: string
): Promise<void> => {
  const profileContext = await loadRequesterProfileContext(env, userId);
  if (!profileContext.ok) {
    await ctx.reply(
      profileUnavailableMessage(profileContext.reason),
      withHtml({ reply_markup: mainMenu })
    );
    return;
  }
  if (!isProfileSearchReady(profileContext)) {
    await ctx.reply(MATCH_SEARCH_INDEX_PENDING, withHtml({ reply_markup: mainMenu }));
    return;
  }

  const search = await searchConversationSuggestions(env, userId, {
    requesterProfileHash: profileContext.profileHash,
    requesterProfile: profileContext.profile,
  });

  if (!search.ok) {
    await ctx.reply(
      searchFailureMessage(search.reason),
      withHtml({ reply_markup: mainMenu })
    );
    return;
  }

  await recordSuggestionSearch(env);
  let issued;
  try {
    issued = await issueSuggestionTickets(env, actorHash, search.results);
    await recordSuggestionExposure(
      env,
      userId,
      issued.map((entry) => entry.pairTag)
    );
  } catch (error) {
    logBotError("runSuggestionSearch:issue", error);
    await ctx.reply(MATCH_SEARCH_FAILED, withHtml({ reply_markup: mainMenu }));
    return;
  }

  if (issued.length === 0) {
    await ctx.reply(MATCH_NO_CANDIDATES, withHtml({ reply_markup: mainMenu }));
    return;
  }

  await recordSuggestionShown(env);

  await ctx.reply(MATCH_CANDIDATES_HEADER, withHtml({ reply_markup: mainMenu }));
  for (const [index, entry] of issued.entries()) {
    await ctx.reply(
      `<b>${index + 1}.</b> ${MATCH_CANDIDATES_WHY_FIT}\n${escapeHtml(entry.explanation)}`,
      withHtml({
        reply_markup: buildSuggestionCandidateKeyboard(entry.suggestionRef),
      })
    );
  }
};

export const handleMatchCommand = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const from = ctx.from;
  if (!from) {
    return;
  }

  await renderSuggestionHub(ctx, env, from.id.toString());
};

export const handleMatchCallback = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const data = ctx.callbackQuery?.data;
  if (!data) {
    return;
  }

  if (data === SUGGESTION_HUB_CALLBACK.hub) {
    const from = ctx.from;
    if (from) {
      await renderSuggestionHub(ctx, env, from.id.toString());
    } else {
      await ctx.answerCallbackQuery();
    }
    return;
  }

  const from = ctx.from;
  if (!from) {
    await ctx.answerCallbackQuery();
    return;
  }

  try {
    const user = await resolveOrCreateUser(ctx, env);
    const actorHash = await hmacTelegramUserId(env.APP_HMAC_PEPPER, from.id);

    if (data === SUGGESTION_HUB_CALLBACK.search) {
      await answerCallbackSafely(ctx);
      try {
        await runSuggestionSearch(ctx, env, user.id, actorHash);
      } catch (error) {
        logBotError("handleMatchCallback:search", error);
        await ctx.reply(HuhMessage, withHtml({ reply_markup: mainMenu }));
      }
      return;
    }

    if (data === SUGGESTION_HUB_CALLBACK.pending) {
      await ctx.answerCallbackQuery();
      await ctx.reply(MATCH_PENDING_EMPTY, withHtml({ reply_markup: mainMenu }));
      return;
    }

    if (data === SUGGESTION_HUB_CALLBACK.profile) {
      await ctx.answerCallbackQuery();
      const profileContext = await loadRequesterProfileContext(env, user.id);
      if (!profileContext.ok) {
        await ctx.reply(
          profileUnavailableMessage(profileContext.reason),
          withHtml({ reply_markup: mainMenu })
        );
        return;
      }

      const summary = buildProfileSummaryText(profileContext.profile, "fa");
      await ctx.reply(
        `${MATCH_PROFILE_HEADER}\n\n` +
          `${escapeHtml(summary)}\n\n` +
          MATCH_PROFILE_PRIVACY_NOTE,
        withHtml({ reply_markup: mainMenu })
      );
      return;
    }

    if (data === SUGGESTION_HUB_CALLBACK.enableDiscover) {
      try {
        const result = await setConversationDiscoverability(env, user.id, true);
        if (!result.ok) {
          const message =
            result.reason === "not_ready"
              ? MATCH_SEARCH_INDEX_PENDING
              : MATCH_PROFILE_NO_ASSESSMENT;
          await ctx.reply(message, withHtml({ reply_markup: mainMenu }));
          return;
        }
        await ctx.reply(
          MATCH_DISCOVERABILITY_ENABLED,
          withHtml({ reply_markup: mainMenu })
        );
        await renderSuggestionHub(ctx, env, from.id.toString(), { skipAnswer: true });
      } finally {
        await answerCallbackSafely(ctx);
      }
      return;
    }

    if (data === SUGGESTION_HUB_CALLBACK.disableDiscover) {
      try {
        await setConversationDiscoverability(env, user.id, false);
        await renderSuggestionHub(ctx, env, from.id.toString(), { skipAnswer: true });
      } finally {
        await answerCallbackSafely(ctx);
      }
      return;
    }

    if (data === SUGGESTION_HUB_CALLBACK.assessment) {
      await ctx.answerCallbackQuery();
      await sendProfileDashboard(ctx, user.id, env);
      return;
    }

    await ctx.answerCallbackQuery();
  } catch (error) {
    logBotError("handleMatchCallback", error);
    await answerCallbackSafely(ctx);
    await ctx.reply(HuhMessage, withHtml({ reply_markup: mainMenu }));
  }
};

export const handleSuggestionCallback = async (
  ctx: Context,
  env: Environment
): Promise<void> => {
  const data = ctx.callbackQuery?.data;
  const from = ctx.from;
  if (!data || !from) {
    await ctx.answerCallbackQuery();
    return;
  }

  const parsed = parseSuggestionCallback(data);
  if (!parsed) {
    await ctx.answerCallbackQuery();
    return;
  }

  const actorHash = await hmacTelegramUserId(env.APP_HMAC_PEPPER, from.id);

  if (parsed.kind === "dismiss") {
    const result = await dismissSuggestionTicket(
      env,
      actorHash,
      parsed.suggestionRef
    );
    await ctx.answerCallbackQuery();
    if (!result.ok) {
      await ctx.reply(MATCH_SUGGESTION_INVALID, withHtml({ reply_markup: mainMenu }));
    }
    return;
  }

  if (parsed.kind === "open") {
    const result = await markSuggestionViewed(env, actorHash, parsed.suggestionRef);
    await ctx.answerCallbackQuery();
    if (!result.ok) {
      await ctx.reply(MATCH_SUGGESTION_INVALID, withHtml({ reply_markup: mainMenu }));
    }
    return;
  }

  const viewed = await markSuggestionViewed(env, actorHash, parsed.suggestionRef);
  if (!viewed.ok) {
    await ctx.answerCallbackQuery();
    await ctx.reply(MATCH_SUGGESTION_INVALID, withHtml({ reply_markup: mainMenu }));
    return;
  }

  const user = await resolveOrCreateUser(ctx, env);
  const prompt = await ctx.reply(
    MATCH_INTRO_PROMPT,
    withHtml({
      reply_markup: buildDraftCancelKeyboard(draftPlaceholder("conversation_intro")),
    })
  );

  await setDraft(env, user.id, {
    id: "primary",
    mode: "conversation_intro",
    linkSlug: parsed.suggestionRef,
    parent_message_id: prompt.message_id,
  });

  await ctx.answerCallbackQuery();
};

export const handleConversationIntroInput = async (
  ctx: Context,
  env: Environment,
  userId: string,
  actorHash: string,
  suggestionRef: string,
  introText: string
): Promise<boolean> => {
  const trimmed = introText.trim();
  if (!trimmed) {
    const { MATCH_INTRO_EMPTY } = await import("../../i18n/matching");
    await ctx.reply(
      MATCH_INTRO_EMPTY,
      withHtml({
        reply_markup: buildDraftCancelKeyboard(draftPlaceholder("conversation_intro")),
      })
    );
    return true;
  }
  if (trimmed.length > INTRO_MAX_CHARS) {
    const { MATCH_INTRO_TOO_LONG } = await import("../../i18n/matching");
    await ctx.reply(
      MATCH_INTRO_TOO_LONG,
      withHtml({
        reply_markup: buildDraftCancelKeyboard(draftPlaceholder("conversation_intro")),
      })
    );
    return true;
  }

  const profileContext = await loadRequesterProfileContext(env, userId);
  if (!profileContext.ok) {
    await ctx.reply(
      profileUnavailableMessage(profileContext.reason),
      withHtml({ reply_markup: mainMenu })
    );
    return true;
  }
  if (!isProfileSearchReady(profileContext)) {
    await ctx.reply(MATCH_SEARCH_INDEX_PENDING, withHtml({ reply_markup: mainMenu }));
    return true;
  }

  const suggestion = await resolveSuggestionRoute(env, actorHash, suggestionRef);
  if (!suggestion.ok) {
    await ctx.reply(MATCH_SUGGESTION_INVALID, withHtml({ reply_markup: mainMenu }));
    return true;
  }

  const { createConversationRequest } = await import("./request-service.ts");
  const requester = await getUserById(userId, env);
  if (!requester) {
    await ctx.reply(MATCH_SUGGESTION_INVALID, withHtml({ reply_markup: mainMenu }));
    return true;
  }
  const result = await createConversationRequest(env, {
    requester,
    requesterActorHash: actorHash,
    requesterProfileHash: profileContext.profileHash,
    candidateProfileHash: suggestion.candidateProfileHash,
    pairTag: suggestion.pairTag,
    introText: trimmed,
    suggestionRef,
    explanation: suggestion.explanation,
  });

  if (!result.ok) {
    const message =
      result.reason === "blocked"
        ? MATCH_RECENT_PAIR_COOLDOWN
        : result.reason === "invalid"
          ? MATCH_REQUEST_LIMIT
          : MATCH_SUGGESTION_INVALID;
    await ctx.reply(message, withHtml({ reply_markup: mainMenu }));
    return true;
  }

  await ctx.reply(MATCH_REQUEST_SENT, withHtml({ reply_markup: mainMenu }));
  return true;
};
