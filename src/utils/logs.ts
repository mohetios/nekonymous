import type { KVModel } from "./kv-storage";
import { convertToPersianNumbers } from "./tools";

/**
 * Increments a stat by a given amount in the KV store.
 *
 * @param {KVModel<number>} statsModel - The stats KV model instance.
 * @param {string} statKey - The key for the statistic to increment.
 * @param {number} amount - The amount by which to increment the stat.
 */
export const incrementStat = async (
  statsModel: KVModel<number>,
  statKey: string,
  amount: number = 1
) => {
  const today = new Date().toISOString().split("T")[0]; // Get only the date part
  const fullStatKey = `${statKey}:${today}`;
  const currentValue = (await statsModel.get(fullStatKey)) || 0;
  await statsModel.save(fullStatKey, currentValue + amount);
};

export const getTotalStats = async (
  statsModel: KVModel<number>
): Promise<{
  conversationsCount: string;
  usersCount: string;
}> => {
  let totalConversationsCount = 0;
  let totalUsersCount = 0;

  // List all keys with the prefix 'newConversation:'
  const conversationKeys = await statsModel.list({
    prefix: "newConversation:",
  });
  for (const key of conversationKeys.keys) {
    const value = await statsModel.get(
      key.name.replace(`${statsModel.namespace}:`, "")
    );
    if (value) {
      totalConversationsCount += value;
    }
  }

  // List all keys with the prefix 'newUser:'
  const userKeys = await statsModel.list({ prefix: "newUser:" });
  for (const key of userKeys.keys) {
    const value = await statsModel.get(
      key.name.replace(`${statsModel.namespace}:`, "")
    );
    if (value) {
      totalUsersCount += value;
    }
  }

  return {
    conversationsCount: convertToPersianNumbers(totalConversationsCount),
    usersCount: convertToPersianNumbers(totalUsersCount),
  };
};
