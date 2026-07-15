import type { Context } from "grammy";
import type { Environment } from "../../../contracts/runtime";
import { getResolvedUser } from "../../../bot/context";
import { renderScreen } from "../../../bot/render-screen";
import { formatSuggestionHubMessage } from "../../../i18n/matching";
import { buildSuggestionHubKeyboard } from "./keyboards";
import { buildSuggestionHubView } from "./hub-state.ts";

export const renderSuggestionHub = async (
  ctx: Context,
  env: Environment,
  _telegramUserId: string,
  renderOptions?: { skipAnswer?: boolean }
): Promise<void> => {
  const user = await getResolvedUser(ctx, env);
  const view = await buildSuggestionHubView(env, user.id);

  await renderScreen(
    ctx,
    {
      text: formatSuggestionHubMessage({
        assessmentLine: view.assessmentLine,
        discoverabilityLine: view.discoverabilityLine,
        pendingLine: view.pendingLine,
        eligibilityLine: view.eligibilityLine,
      }),
      replyMarkup: buildSuggestionHubKeyboard(view.keyboard),
    },
    renderOptions
  );
};
