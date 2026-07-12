import type { Environment } from "../types";
import type { TelegramOutboxJob } from "../queues/telegram-outbox.types";

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
): Promise<{
  ok: boolean;
  duplicate?: boolean;
  permanentFailure?: boolean;
  retryable?: boolean;
  delaySeconds?: number;
}> => {
  const stub = env.TELEGRAM_OUTBOX_DO.get(
    env.TELEGRAM_OUTBOX_DO.idFromName(job.chatHash)
  );
  const response = await stub.fetch("https://outbox/send", {
    method: "POST",
    body: JSON.stringify(job),
  });

  if (!response.ok) {
    const body: { retryable?: boolean; delaySeconds?: number } = await response
      .json<{ retryable?: boolean; delaySeconds?: number }>()
      .catch(() => ({}));
    return {
      ok: false,
      retryable: body.retryable ?? response.status >= 500,
      delaySeconds: body.delaySeconds,
    };
  }

  const body = await response.json<{
    ok: boolean;
    duplicate?: boolean;
    permanentFailure?: boolean;
  }>();
  return body;
};
