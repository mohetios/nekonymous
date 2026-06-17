import { ASSESSMENT_DIMENSIONS } from "./question-bank";
import type { AssessmentScores } from "./scoring";

export const scoresToJson = (scores: AssessmentScores): string =>
  JSON.stringify(scores);

export const parseDimensionScores = (json: string): AssessmentScores | null => {
  try {
    const parsed = JSON.parse(json) as Partial<AssessmentScores>;
    for (const key of ASSESSMENT_DIMENSIONS) {
      const value = parsed[key];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return null;
      }
    }
    return parsed as AssessmentScores;
  } catch {
    return null;
  }
};

export const scoresFromJson = (
  json: string,
  userId = "unknown"
): AssessmentScores => {
  const scores = parseDimensionScores(json);
  if (!scores) {
    throw new Error(`Invalid dimension_scores_json for user ${userId}`);
  }
  return scores;
};
