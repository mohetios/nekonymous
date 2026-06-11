const RATE_LIMIT = 5; // seconds

/**
 * Escapes special characters for Telegram's MarkdownV2 formatting.
 * This function ensures that any special characters in the input text are properly escaped
 * to prevent issues with Telegram's MarkdownV2 formatting.
 *
 * @param {string} text - The text to escape.
 * @returns {string} - The escaped text.
 */
export const escapeMarkdownV2 = (text: string): string => {
  return text.replace(/[_*[\]()~`>#+-=|{}.!\\]/g, "\\$&");
};

/**
 * Converts English digits in a number or string to Persian digits.
 * This function uses a regular expression and a direct character mapping for optimal performance.
 *
 * @param {string | number} input - The input string or number containing English digits to convert.
 * @returns {string} - The input with English digits converted to Persian digits.
 */
export const convertToPersianNumbers = (input: string | number): string => {
  // Convert the input to a string to ensure we can work with it.
  const inputStr = input.toString();

  // Use a regular expression to replace English digits with Persian digits.
  return inputStr.replace(/\d/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 1728)
  );
};

/**
 * Checks if the user is sending messages too quickly.
 * Alerts the user if they are within the rate limit threshold.
 *
 * @param lastMessage - The timestamp of the user's last message in milliseconds.
 * @returns {boolean} - Returns true if the user is within the rate limit, otherwise false.
 */
export const checkRateLimit = (lastMessage?: number): boolean => {
  if (lastMessage === undefined) {
    return false;
  }

  const currentTime = Date.now();
  const timeDifference = currentTime - lastMessage;

  // Check if the time difference is less than 4 seconds (4000 milliseconds)
  if (timeDifference < RATE_LIMIT * 1000) {
    return true; // Rate limit exceeded
  }

  return false; // Rate limit not exceeded
};
