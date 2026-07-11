export function getApifyConfig() {
  return {
    enabled: Boolean(process.env.APIFY_API_KEY),
    apiKey: process.env.APIFY_API_KEY ?? ""
  };
}
