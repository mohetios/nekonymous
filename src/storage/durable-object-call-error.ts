export class DurableObjectCallError extends Error {
  constructor(
    readonly status: number,
    readonly operation: string
  ) {
    super(`${operation} failed: ${status}`);
    this.name = "DurableObjectCallError";
  }
}

export const isDurableObjectCallError = (
  error: unknown
): error is DurableObjectCallError => error instanceof DurableObjectCallError;
