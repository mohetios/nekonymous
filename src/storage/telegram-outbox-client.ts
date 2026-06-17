import type { Environment } from "../types";
import type { TelegramOutboxJob } from "../queues/telegram-outbox.types";

export const enqueueTelegramOutbox = async (
  env: Environment,
  job: TelegramOutboxJob
): Promise<void> => {
  await env.TELEGRAM_OUTBOX_QUEUE.send(job, {
    contentType: "json",
  });
};

export const sendViaOutboxDo = async (
  env: Environment,
  job: TelegramOutboxJob
): Promise<{ ok: boolean; duplicate?: boolean }> => {
  const stub = env.TELEGRAM_OUTBOX_DO.get(
    env.TELEGRAM_OUTBOX_DO.idFromName(job.chatHash)
  );
  const response = await stub.fetch("https://outbox/send", {
    method: "POST",
    body: JSON.stringify(job),
  });

  if (!response.ok) {
    return { ok: false };
  }

  const body = await response.json<{ ok: boolean; duplicate?: boolean }>();
  return body;
};
