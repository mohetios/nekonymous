export const logBotError = (context: string, error: unknown): void => {
  console.error(`[${context}]`, error);
};
