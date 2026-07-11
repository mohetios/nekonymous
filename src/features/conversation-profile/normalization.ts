import { LIKERT_MAX, LIKERT_MIN, NO_PREFERENCE_VALUE } from "./constants.ts";

export const normalizeLikert = (value: number): number => {
  if (value < LIKERT_MIN || value > LIKERT_MAX) {
    throw new Error("Likert value out of range");
  }
  return (value - LIKERT_MIN) / (LIKERT_MAX - LIKERT_MIN);
};

export const computeAxisAgreement = (first: number, second: number): number => {
  const gap = Math.abs(first - second);
  const maxGap = LIKERT_MAX - LIKERT_MIN;
  return 1 - gap / maxGap;
};

export const effectiveDimensionWeight = (
  importance: number,
  agreement: number
): number => importance * (0.5 + agreement * 0.5);

export const isNoPreferenceDesired = (value: number): boolean =>
  value === NO_PREFERENCE_VALUE;
