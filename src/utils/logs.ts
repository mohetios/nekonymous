import type { LogErrorMeta } from "../contracts/logging";

export const logBotError = (
  context: string,
  error: unknown,
  meta?: LogErrorMeta
): void => {
  const serialized =
    error instanceof Error
      ? {
          name: error.name,
          message: error.message,
        }
      : {
          name: "UnknownError",
          message: typeof error === "string" ? error : "Non-error thrown",
        };

  console.error(
    JSON.stringify({
      level: "error",
      context,
      error: serialized,
      ...(meta ? { meta } : {}),
    })
  );
};

/** Safe hot-path timing (no IDs / capabilities / tags). */
export const logBotTiming = (
  context: string,
  timings: Readonly<Record<string, number>>
): void => {
  console.warn(
    JSON.stringify({
      level: "info",
      context,
      timings,
    })
  );
};
