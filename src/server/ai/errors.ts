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
export class AIProviderError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "AIProviderError";
    this.status = status;
  }
}
