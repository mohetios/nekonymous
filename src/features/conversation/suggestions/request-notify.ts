import type { D1User, Environment } from "../../../types";
import { REQUEST_CALLBACK } from "./constants.ts";
import {
  MATCH_INCOMING_ACCEPT_NOTE,
  MATCH_INCOMING_INTRO_LABEL,
  MATCH_INCOMING_WHY_FIT,
} from "../../../i18n/matching.ts";
import { escapeHtml } from "../../../utils/text.ts";
import { getUserById } from "../../identity/identity-service.ts";
import { enqueueTelegramOutbox } from "../../../storage/telegram-outbox-client.ts";
import { resolveCandidateDeliveryUserId } from "../profile/profile-service.ts";

const truncateIntro = (intro: string, max = 240): string =>
  intro.length <= max ? intro : `${intro.slice(0, max - 1)}…`;

export const notifyIncomingConversationRequest = async (
  env: Environment,
  candidateProfileHash: string,
  requestRef: string,
  requestHash: string,
  introText: string,
  explanation: string
): Promise<void> => {
  const candidateUserId = await resolveCandidateDeliveryUserId(
    env,
    candidateProfileHash
  );
  if (!candidateUserId) {
    return;
  }

  const candidate = await getUserById(candidateUserId, env);
  if (!candidate) {
    return;
  }

  const text =
    `${MATCH_INCOMING_ACCEPT_NOTE}\n\n` +
    `${MATCH_INCOMING_WHY_FIT}\n${escapeHtml(explanation)}\n\n` +
    `${MATCH_INCOMING_INTRO_LABEL}\n${escapeHtml(truncateIntro(introText))}`;

  await enqueueTelegramOutbox(env, {
    idempotencyKey: `request-notify:${requestHash}`,
    chatCiphertext: candidate.telegram_chat_ciphertext,
    chatHash: candidate.telegram_user_hash,
    method: "sendMessage",
    payload: {
      text,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ پذیرفتن",
              callback_data: REQUEST_CALLBACK.accept(requestRef),
            },
            {
              text: "❌ رد کردن",
              callback_data: REQUEST_CALLBACK.decline(requestRef),
            },
          ],
        ],
      },
    },
    priority: "normal",
    createdAt: Date.now(),
  });
};

export const notifyRequesterAccepted = async (
  env: Environment,
  requester: D1User,
  requestHash: string
): Promise<void> => {
  const { MATCH_ACCEPTED_REQUESTER } = await import("../../../i18n/matching.ts");
  await enqueueTelegramOutbox(env, {
    idempotencyKey: `request-accepted:${requestHash}`,
    chatCiphertext: requester.telegram_chat_ciphertext,
    chatHash: requester.telegram_user_hash,
    method: "sendMessage",
    payload: {
      text: MATCH_ACCEPTED_REQUESTER,
      parse_mode: "HTML",
    },
    priority: "low",
    createdAt: Date.now(),
  });
};

export const notifyRequesterDeclined = async (
  env: Environment,
  requester: D1User,
  requestHash: string
): Promise<void> => {
  const { MATCH_DECLINED_REQUESTER } = await import("../../../i18n/matching.ts");
  await enqueueTelegramOutbox(env, {
    idempotencyKey: `request-declined:${requestHash}`,
    chatCiphertext: requester.telegram_chat_ciphertext,
    chatHash: requester.telegram_user_hash,
    method: "sendMessage",
    payload: {
      text: MATCH_DECLINED_REQUESTER,
      parse_mode: "HTML",
    },
    priority: "low",
    createdAt: Date.now(),
  });
};
