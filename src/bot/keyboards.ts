import { InlineKeyboard, Keyboard } from "grammy";
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

export const createMessageKeyboard = (
  capability: string,
  isBlocked: boolean
): InlineKeyboard => {
  const blockData = isBlocked
    ? inboxCallback("unblock", capability)
    : inboxCallback("block", capability);
  const replyData = inboxCallback("reply", capability);
  const nicknameData = inboxCallback("nickname", capability);
  const reportData = inboxCallback("report", capability);

  return new InlineKeyboard()
    .text(INBOX_BUTTON.reply, replyData)
    .text(INBOX_BUTTON.nickname, nicknameData)
    .row()
    .text(isBlocked ? INBOX_BUTTON.unblock : INBOX_BUTTON.block, blockData)
    .text(INBOX_BUTTON.report, reportData);
};
