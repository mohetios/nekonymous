import type { Context } from "grammy";
import type { InlineKeyboard } from "grammy";
import { withHtml } from "../utils/tools";

export type RenderedScreen = {
  text: string;
  replyMarkup: InlineKeyboard;
};

const isBenignEditError = (error: unknown): boolean => {
  if (!error || typeof error !== "object" || !("description" in error)) {
    return false;
  }
  const description = String(error.description);
  return (
    description.includes("message is not modified") ||
    description.includes("there is no text in the message to edit")
  );
};

export const renderScreen = async (
  ctx: Context,
  screen: RenderedScreen,
  renderOptions?: { skipAnswer?: boolean }
): Promise<void> => {
  const options = withHtml({ reply_markup: screen.replyMarkup });

  if (ctx.callbackQuery?.message) {
    if (!renderOptions?.skipAnswer) {
      await ctx.answerCallbackQuery();
    }
    try {
      await ctx.editMessageText(screen.text, options);
      return;
    } catch (error) {
      if (isBenignEditError(error)) {
        return;
      }
    }
  }

  await ctx.reply(screen.text, options);
};
