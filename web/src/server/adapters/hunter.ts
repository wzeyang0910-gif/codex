export function getHunterConfig() {
  return {
    enabled: Boolean(process.env.HUNTER_API_KEY),
    apiKey: process.env.HUNTER_API_KEY ?? ""
  };
}
