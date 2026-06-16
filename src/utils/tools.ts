import type { Context } from "grammy";

type ReplyOptions = NonNullable<Parameters<Context["reply"]>[1]>;

export const escapeMarkdownV2 = (text: string): string =>
  text.replace(/[_*[\]()~`>#+-=|{}.!\\]/g, "\\$&");

export const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const timingSafeEqual = (left: string, right: string): boolean => {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let i = 0; i < maxLength; i++) {
    diff |= (leftBytes[i] ?? 0) ^ (rightBytes[i] ?? 0);
  }

  return diff === 0;
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
