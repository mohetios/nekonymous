import type { AssessmentResultSummary, AssessmentScores } from "./scoring";

const band = (score: number): string => {
  if (score >= 67) {
    return "high";
  }
  if (score <= 33) {
    return "low";
  }
  return "moderate";
};

const paceLabel = (scores: AssessmentScores): string => {
  if (scores.replyPace >= 67) {
    return "patient with slow replies";
  }
  if (scores.replyPace <= 33) {
    return "prefers steady reply rhythm";
  }
  return "flexible reply pace";
};

const depthLabel = (scores: AssessmentScores): string => {
  const depth = (scores.depthPreference + scores.curiosityDepth) / 2;
  if (depth >= 67) {
    return "deep, thoughtful";
  }
  if (depth <= 33) {
    return "light, everyday";
  }
  return "balanced depth";
};

const pressureLabel = (scores: AssessmentScores): string => {
  if (scores.supportNeed >= 67) {
    return "low-pressure, listener-oriented";
  }
  return "low-pressure";
};

export const buildProfileEmbeddingText = (
  scores: AssessmentScores,
  _summary: AssessmentResultSummary,
  locale: string
): string => {
  const lines = [
    `Language: ${locale}.`,
    `Conversation profile: ${paceLabel(scores)}, ${depthLabel(scores)}, ${pressureLabel(scores)} anonymous conversations.`,
    `Signals: ${band(scores.curiosityDepth)} curiosity and depth preference, ${band(scores.honestyBoundaryRespect)} boundary respect, ${band(scores.warmthCooperation)} warm cooperative style, ${band(scores.emotionalReactivity)} emotional reactivity.`,
    `Communication preferences: prefers clear boundaries, respectful tone, ${band(scores.directness)} directness, no pressure to continue.`,
  ];

  return lines.join("\n");
};
