export type LogErrorMeta = Readonly<{
  retryable?: boolean;
  permanent?: boolean;
  delaySeconds?: number;
}>;
