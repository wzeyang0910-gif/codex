import { getServerProviderConfig } from "./provider-config";

export function getApifyConfig() {
  return getServerProviderConfig("APIFY_API_KEY");
}
