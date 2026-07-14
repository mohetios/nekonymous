import type { Environment } from "../../contracts/runtime";
import type { InboxNotificationCycleId, InternalAccountId } from "../../contracts/primitives";

export const enqueueInboxNotification = async (
  env: Environment,
  accountId: InternalAccountId,
  cycleId: InboxNotificationCycleId
): Promise<void> => {
  await env.NEKO_OUTBOX_QUEUE.send(
    {
      kind: "inbox-notification",
      accountId,
      cycleId,
    },
    { contentType: "json" }
  );
};
