import type { Environment } from "../types";

const KV_PREFIXES = [
  "conversation:",
  "user:",
  "userUUIDtoId:",
  "stats:",
] as const;

const listKeys = async (kv: KVNamespace, prefix: string): Promise<string[]> => {
  const names: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await kv.list({ prefix, cursor });
    names.push(...page.keys.map((key) => key.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return names;
};

/** POST /admin/cleanup — Authorization: Bearer BOT_SECRET_KEY */
export const handleAdminCleanup = async (
  request: Request,
  env: Environment
): Promise<Response> => {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (request.headers.get("Authorization") !== `Bearer ${env.BOT_SECRET_KEY}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userKeys = await listKeys(env.NekonymousKV, "user:");
  let inboxesPurged = 0;

  for (const keyName of userKeys) {
    const userId = keyName.slice("user:".length);
    if (!userId) {
      continue;
    }

    const stub = env.INBOX_DO.get(env.INBOX_DO.idFromName(userId));
    const response = await stub.fetch("https://inbox/purge", { method: "DELETE" });
    if (response.ok) {
      inboxesPurged += 1;
    }
  }

  const deletedByPrefix: Record<string, number> = {};
  let keysDeleted = 0;

  for (const prefix of KV_PREFIXES) {
    const keys = await listKeys(env.NekonymousKV, prefix);
    if (keys.length > 0) {
      await Promise.all(keys.map((name) => env.NekonymousKV.delete(name)));
    }
    deletedByPrefix[prefix] = keys.length;
    keysDeleted += keys.length;
  }

  return Response.json({
    inboxesPurged,
    keysDeleted,
    deletedByPrefix,
  });
};
