export const logBotError = (context: string, error: unknown): void => {
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
    })
  );
};
