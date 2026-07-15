export type ProfileSchemaVersion = "current";

export type ConversationDimension =
  | "depth"
  | "replyPace"
  | "directness"
  | "energy"
  | "playfulness"
  | "supportStyle"
  | "disclosurePace"
  | "repairStyle";

export type ConversationIntent =
  | "light"
  | "deep"
  | "support"
  | "exploration"
  | "open";

export type ProfileLocale = "fa" | "en";

export type ProfileQuestionKind = "self" | "desired" | "intent";

export type ProfileQuestion = {
  id: string;
  index: number;
  kind: ProfileQuestionKind;
  dimension?: ConversationDimension;
  selfItem?: 1 | 2;
  text: string;
  textEn: string;
};

export type ProfileAnswers = Record<string, number | ConversationIntent>;

export type ProfileSessionStatus = "active" | "ready_to_submit" | "completed";

export type ProfileSession = {
  id: string;
  version: ProfileSchemaVersion;
  status: ProfileSessionStatus;
  currentIndex: number;
  totalQuestions: number;
  answers: ProfileAnswers;
  startedAt: number;
  updatedAt: number;
  expiresAt: number | null;
};

export type ConversationProfile = {
  selfStyle: Record<ConversationDimension, number>;
  desiredStyle: Record<ConversationDimension, number>;
  importance: Record<ConversationDimension, number>;
  axisAgreement: Record<ConversationDimension, number>;
  currentIntent: ConversationIntent;
  locale: ProfileLocale;
  revision: number;
  schemaVersion: ProfileSchemaVersion;
};

export type ProfileBuildResult = {
  profile: ConversationProfile;
  summaryText: string;
};
