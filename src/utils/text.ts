import type { Context } from "grammy";

type ReplyOptions = NonNullable<Parameters<Context["reply"]>[1]>;

export const escapeTelegramMarkdown = (text: string): string =>
  text.replace(/[_*[\]()~`>#+-=|{}.!\\]/g, "\\$&");

export const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const stripControlCharacters = (text: string): string =>
  Array.from(text)
    .filter((char) => {
      const code = char.codePointAt(0);
      return code === undefined || (code > 0x1f && code !== 0x7f);
    })
    .join("");

export const truncateGraphemes = (text: string, maxLength: number): string => {
  if (maxLength <= 0) {
    return "";
  }
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    let output = "";
    let count = 0;
    for (const { segment } of segmenter.segment(text)) {
      if (count >= maxLength) {
        break;
      }
      output += segment;
      count += 1;
    }
    return output;
  }
  return Array.from(text).slice(0, maxLength).join("");
};

export const withHtml = (
  options: Record<string, unknown> = {}
): { parse_mode: "HTML" } & Record<string, unknown> => ({
  parse_mode: "HTML",
  ...options,
});

/** Use for bot copy that contains HTML tags (`<b>`, `<i>`, `<code>`, …). */
export const replyHtml = (
  ctx: Context,
  text: string,
  options?: ReplyOptions
) => ctx.reply(text, withHtml(options));

export const convertToPersianNumbers = (input: string | number): string =>
  input.toString().replace(/\d/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 1728)
  );
