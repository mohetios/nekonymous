import { Keyboard } from "grammy";
import {
  encodeInboxCallbackData,
  type InboxCallbackAction,
} from "../bot/callback-data";
import { INBOX_BUTTON, MENU } from "./menu-labels";

const inboxCallback = (action: InboxCallbackAction, ticketRef: string): string =>
  encodeInboxCallbackData(action, ticketRef);

export const mainMenu = new Keyboard()
  .text(MENU.link)
  .text(MENU.inbox)
  .row()
  .text(MENU.matchSystem)
  .text(MENU.settings)
  .resized()
  .persistent();

/** Plain Telegram inline keyboard — safe to pass across DO/Queue serialization. */
export const createMessageKeyboard = (
  capability: string,
  isBlocked: boolean
): {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
} => {
  const blockData = isBlocked
    ? inboxCallback("unblock", capability)
    : inboxCallback("block", capability);
  const replyData = inboxCallback("reply", capability);
  const nicknameData = inboxCallback("nickname", capability);
  const reportData = inboxCallback("report", capability);

  return {
    inline_keyboard: [
      [
        { text: INBOX_BUTTON.reply, callback_data: replyData },
        { text: INBOX_BUTTON.nickname, callback_data: nicknameData },
      ],
      [
        {
          text: isBlocked ? INBOX_BUTTON.unblock : INBOX_BUTTON.block,
          callback_data: blockData,
        },
        { text: INBOX_BUTTON.report, callback_data: reportData },
      ],
    ],
  };
};
