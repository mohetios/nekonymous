import type { Environment } from "../contracts/runtime";
import type {
  TelegramOutboxJob,
  TelegramOutboxSendResult,
} from "../contracts/telegram/outbox";

export const enqueueTelegramOutbox = async (
  env: Environment,
  job: TelegramOutboxJob
): Promise<void> => {
  await env.NEKO_OUTBOX_QUEUE.send(job, {
    contentType: "json",
  });
};

export const sendViaOutboxDo = async (
  env: Environment,
  job: TelegramOutboxJob
): Promise<TelegramOutboxSendResult> => {
  const stub = env.TELEGRAM_OUTBOX_DO.get(
    env.TELEGRAM_OUTBOX_DO.idFromName(job.chatHash)
  );
  return stub.sendJob(job);
};
