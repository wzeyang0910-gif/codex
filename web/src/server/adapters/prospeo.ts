export function getProspeoConfig() {
  return {
    enabled: Boolean(process.env.PROSPEO_API_KEY),
    apiKey: process.env.PROSPEO_API_KEY ?? ""
  };
}
