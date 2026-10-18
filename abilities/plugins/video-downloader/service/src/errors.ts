/** A failure the HTTP layer can map to a specific status and machine-readable code. */
export class ServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
