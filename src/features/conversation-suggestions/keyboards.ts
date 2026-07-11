import { InlineKeyboard } from "grammy";
import { SUGGESTION_CALLBACK, SUGGESTION_HUB_CALLBACK } from "./constants";
import { MATCH_BUTTON, MENU, BACK_BUTTON } from "../../i18n/labels";
import type { SuggestionHubMenuOptions } from "./types";

export const buildSuggestionHubKeyboard = (
  options: SuggestionHubMenuOptions & { showPending: boolean }
): InlineKeyboard => {
  const keyboard = new InlineKeyboard();

  if (options.showFind) {
    keyboard.text(MATCH_BUTTON.search, SUGGESTION_HUB_CALLBACK.search).row();
  }

  if (options.showPending || options.showProfile) {
    if (options.showPending) {
      keyboard.text(MATCH_BUTTON.pending, SUGGESTION_HUB_CALLBACK.pending);
    }
    if (options.showProfile) {
      keyboard.text(MATCH_BUTTON.profile, SUGGESTION_HUB_CALLBACK.profile);
    }
    keyboard.row();
  }

  if (options.discoverabilityVariant === "can_disable") {
    keyboard
      .text(MENU.matchDisable, SUGGESTION_HUB_CALLBACK.disableDiscover)
      .row();
  } else if (options.discoverabilityVariant === "can_enable") {
    keyboard
      .text(MENU.matchEnable, SUGGESTION_HUB_CALLBACK.enableDiscover)
      .row();
  }

  keyboard.text(options.assessmentLabel, SUGGESTION_HUB_CALLBACK.assessment);

  return keyboard;
};

export const buildSuggestionCandidateKeyboard = (
  suggestionRef: string
): InlineKeyboard =>
  new InlineKeyboard()
    .text(MATCH_BUTTON.writeIntro(0), SUGGESTION_CALLBACK.request(suggestionRef))
    .text(MATCH_BUTTON.dismiss, SUGGESTION_CALLBACK.dismiss(suggestionRef))
    .row()
    .text(BACK_BUTTON.toSuggestions, SUGGESTION_HUB_CALLBACK.hub);
