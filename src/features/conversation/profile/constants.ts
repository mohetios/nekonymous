import type { ConversationDimension } from "../../../contracts/conversation/profile";

export const PROFILE_SCHEMA_VERSION = "v2" as const;

export const PROFILE_QUESTION_COUNT = 25;

export const PROFILE_SESSION_ID = "active";

export const NO_PREFERENCE_VALUE = 0;

export const LIKERT_MIN = 1;
export const LIKERT_MAX = 5;

export const CONVERSATION_DIMENSIONS: ConversationDimension[] = [
  "depth",
  "replyPace",
  "directness",
  "energy",
  "playfulness",
  "supportStyle",
  "disclosurePace",
  "repairStyle",
];

/** Fixed non-zero weights when desired-style preference is explicit. */
export const DIMENSION_IMPORTANCE_WEIGHT: Record<ConversationDimension, number> = {
  depth: 0.9,
  replyPace: 0.75,
  directness: 0.8,
  energy: 0.7,
  playfulness: 0.65,
  supportStyle: 0.85,
  disclosurePace: 0.8,
  repairStyle: 0.75,
};

export const PROFILE_CALLBACK = {
  answer: (index: number, value: number) => `t:a:${index}:${value}`,
  intent: (intent: string) => `t:i:${intent}`,
  previous: "t:p",
  exit: "t:exit",
  start: "t:start",
  continue: "t:continue",
  submit: "t:submit",
  result: "t:result",
  reset: "t:reset",
  resetYes: "t:reset_yes",
  resetNo: "t:reset_no",
  hub: "t:hub",
} as const;
