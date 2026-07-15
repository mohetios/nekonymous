export const TELEGRAM_MESSAGE_TEXT_MAX = 4096;
export const TELEGRAM_CAPTION_MAX = 1024;

const textEncoder = new TextEncoder();
const ELLIPSIS = "…";
const ELLIPSIS_BYTES = textEncoder.encode(ELLIPSIS).byteLength;

export const truncateUtf8 = (text: string, maxBytes: number): string => {
  const limit = Math.max(0, Math.floor(maxBytes));
  if (textEncoder.encode(text).byteLength <= limit) {
    return text;
  }

  if (limit < ELLIPSIS_BYTES) {
    return "";
  }

  let output = "";
  let usedBytes = ELLIPSIS_BYTES;
  for (const char of text) {
    const charBytes = textEncoder.encode(char).byteLength;
    if (usedBytes + charBytes > limit) {
      break;
    }
    output += char;
    usedBytes += charBytes;
  }

  return `${output}${ELLIPSIS}`;
};
