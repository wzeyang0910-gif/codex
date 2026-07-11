export function getServerProviderConfig(environmentVariable: string) {
  if (typeof window !== "undefined") {
    throw new Error("Provider configuration is available only in the server runtime.");
  }

  const apiKey = process.env[environmentVariable] ?? "";

  return {
    enabled: Boolean(apiKey),
    apiKey
  };
}
