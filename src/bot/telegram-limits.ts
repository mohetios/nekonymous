export const TELEGRAM_MESSAGE_TEXT_MAX = 4096;
export const TELEGRAM_CAPTION_MAX = 1024;

export const truncateUtf8 = (text: string, maxBytes: number): string => {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length <= maxBytes) {
    return text;
  }

  let end = text.length;
  while (end > 0) {
    const slice = text.slice(0, end);
    if (new TextEncoder().encode(slice).length <= maxBytes - 3) {
      return `${slice}…`;
    }
    end -= 1;
  }

  return "…";
};
