import { InlineKeyboard, Keyboard, type Context } from "grammy";
import { ABOUT_PRIVACY_COMMAND_MESSAGE, USER_LINK_MESSAGE } from "./messages";
import { escapeMarkdownV2 } from "./tools";

// Main menu keyboard used across various commands
export const mainMenu = new Keyboard()
  .text("درباره و حریم خصوصی")
  .text("دریافت لینک")
  .resized();

/**
 * Handles menu-related commands such as "دریافت لینک", "درباره", etc.
 *
 * @param {Context} ctx - The context of the current Telegram update.
 * @param {string} userUUID - The UUID of the current user.
 * @returns {Promise<boolean>} - Returns true if a command was successfully handled, otherwise false.
 */
export const handleMenuCommand = async (
  ctx: Context,
  userUUID: string
): Promise<boolean> => {
  const msgPayload = ctx.message?.text;

  switch (msgPayload) {
    case "دریافت لینک":
      await ctx.reply(
        USER_LINK_MESSAGE.replace(
          "UUID_USER_URL",
          `https://t.me/nekonymous_bot?start=${userUUID}`
        ),
        {
          reply_markup: mainMenu,
        }
      );
      break;
    case "درباره و حریم خصوصی":
      await ctx.reply(escapeMarkdownV2(ABOUT_PRIVACY_COMMAND_MESSAGE), {
        reply_markup: mainMenu,
        parse_mode: "MarkdownV2",
      });
      break;
    default:
      return false;
  }

  return true;
};

/**
 * Creates an inline keyboard with options to reply or block/unblock a user.
 *
 * This function generates an inline keyboard that allows users to either reply to a message
 * or block/unblock the sender, depending on the current blocked status.
 *
 * @param {string} ticketId - The unique ID of the conversation or message.
 * @param {boolean} isBlocked - Indicates whether the user is currently blocked.
 * @returns {InlineKeyboard} - The generated inline keyboard.
 */
export const createMessageKeyboard = (
  ticketId: string,
  isBlocked: boolean
): InlineKeyboard =>
  new InlineKeyboard()
    .text(
      isBlocked ? "آنبلاک" : "بلاک",
      isBlocked ? `unblock_${ticketId}` : `block_${ticketId}`
    )
    .text("پاسخ", `reply_${ticketId}`);
