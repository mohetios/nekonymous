import type { Environment } from "../../types";
import { emitStat } from "../../stats/emit-stat";
import { getDashboardStats } from "../../stats/dashboard-stats";

type PlatformStatField =
  | "messages_relayed"
  | "assessment_completions"
  | "match_requests";

export const incrementPlatformStat = async (
  env: Environment,
  field: PlatformStatField,
  amount = 1
): Promise<void> => {
  if (amount <= 0) {
    return;
  }
  for (let i = 0; i < amount; i += 1) {
    await emitStat(env, field);
  }
};

export const getPlatformStats = async (
  env: Environment
): Promise<{
  usersCount: number;
  conversationsCount: number;
  assessmentProfilesCount: number;
  discoverableProfilesCount: number;
  matchRequestsCount: number;
}> => {
  return getDashboardStats(env);
};
