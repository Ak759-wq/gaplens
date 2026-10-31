/** Thrown when a required integration (API key, DB creds) is not configured. */
export class ConfigError extends Error {
  readonly missing: string[];
  constructor(message: string, missing: string[] = []) {
    super(message);
    this.name = "ConfigError";
    this.missing = missing;
  }
}

/** Thrown when an upstream AI provider returns an error or unusable output. */
export type AIErrorCode = "rate_limited" | "auth" | "bad_request" | "timeout" | "blocked" | "invalid_output" | "provider";

export class AIProviderError extends Error {
  readonly status?: number;
  readonly code: AIErrorCode;
  /** Seconds the provider asked us to wait (429), when known. */
  readonly retryAfterSec?: number;
  constructor(message: string, status?: number, opts: { code?: AIErrorCode; retryAfterSec?: number } = {}) {
    super(message);
    this.name = "AIProviderError";
    this.status = status;
    this.code =
      opts.code ??
      (status === 429 ? "rate_limited" : status === 401 || status === 403 ? "auth" : status === 400 || status === 404 ? "bad_request" : "provider");
    this.retryAfterSec = opts.retryAfterSec;
  }
}
