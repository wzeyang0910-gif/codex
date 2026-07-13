type SessionEnvironment = Readonly<Record<string, string | undefined>>;

const MINIMUM_SECRET_LENGTH = 32;
const MINIMUM_UNIQUE_CHARACTERS = 8;
const PLACEHOLDER_SECRETS = new Set([
  "replace-with-a-long-random-string",
  "your_long_random_session_secret",
  "change-me-to-a-long-random-secret"
]);
const CONFIGURATION_ERROR = "SESSION_SECRET is not securely configured; use at least 32 random characters";

export function getSessionSecret(environment: SessionEnvironment = process.env): string {
  const secret = environment.SESSION_SECRET;
  const normalizedSecret = secret?.trim().toLowerCase();

  if (
    !secret?.trim() ||
    secret.length < MINIMUM_SECRET_LENGTH ||
    PLACEHOLDER_SECRETS.has(normalizedSecret ?? "") ||
    new Set(secret).size < MINIMUM_UNIQUE_CHARACTERS
  ) {
    throw new Error(CONFIGURATION_ERROR);
  }

  return secret;
}
