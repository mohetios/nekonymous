export type MatchQualityLabel = "strong" | "good" | "moderate" | "limited";

export const MATCH_QUALITY_COPY: Record<MatchQualityLabel, string> = {
  strong: "شباهت بالا",
  good: "شباهت خوب",
  moderate: "شباهت متوسط",
  limited: "شباهت محدود",
};

export const MATCH_LIMITED_SIMILARITY_NOTE =
  "شباهت این پیشنهاد محدود است، اما در حال حاضر یکی از نزدیک‌ترین گزینه‌های موجود است.\n" +
  "اگر خواستی، با یک پیام کوتاه و کم‌فشار شروع کن.";

export const MATCH_SIMILARITY_DISCLAIMER =
  "این درصد قطعی نیست؛ فقط یک سیگنال برای شروع گفت‌وگوست.";

export const getMatchQualityLabel = (score: number): MatchQualityLabel => {
  const safe = Number.isFinite(score) ? score : 0;
  if (safe >= 75) {
    return "strong";
  }
  if (safe >= 60) {
    return "good";
  }
  if (safe >= 40) {
    return "moderate";
  }
  return "limited";
};

export const formatMatchRequestSimilarityLine = (
  scoreText: string,
  qualityLabel: MatchQualityLabel
): string => {
  if (qualityLabel === "limited") {
    return (
      `یک نفر از بین گزینه‌های فعلی با حدود ${scoreText}٪ شباهت می‌خواهد با تو یک گفت‌وگوی ناشناس کم‌فشار شروع کند.`
    );
  }
  return (
    `یک نفر با حدود ${scoreText}٪ شباهت در سبک گفت‌وگو می‌خواهد با تو یک گفت‌وگوی ناشناس شروع کند.`
  );
};
