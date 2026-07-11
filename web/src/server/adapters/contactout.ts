export function getContactOutConfig() {
  return {
    enabled: Boolean(process.env.CONTACTOUT_API_KEY),
    apiKey: process.env.CONTACTOUT_API_KEY ?? ""
  };
}
