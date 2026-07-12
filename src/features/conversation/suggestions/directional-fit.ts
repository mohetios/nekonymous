import { CONVERSATION_DIMENSIONS } from "../profile/constants.ts";
import { effectiveDimensionWeight } from "../profile/normalization.ts";
import type { ConversationProfile } from "../profile/types.ts";

export const computeDirectionalFit = (
  observer: ConversationProfile,
  target: ConversationProfile
): number => {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const dimension of CONVERSATION_DIMENSIONS) {
    const importance = observer.importance[dimension];
    if (importance <= 0) {
      continue;
    }

    const desired = observer.desiredStyle[dimension];
    const targetSelf = target.selfStyle[dimension];
    const fit = 1 - Math.abs(desired - targetSelf);
    const weight = effectiveDimensionWeight(
      importance,
      observer.axisAgreement[dimension]
    );

    weightedSum += fit * weight;
    totalWeight += weight;
  }

  if (totalWeight <= 0) {
    return 0.5;
  }

  return weightedSum / totalWeight;
};
