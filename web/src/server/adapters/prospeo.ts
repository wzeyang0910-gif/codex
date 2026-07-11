import { getServerProviderConfig } from "./provider-config";

export function getProspeoConfig() {
  return getServerProviderConfig("PROSPEO_API_KEY");
}
