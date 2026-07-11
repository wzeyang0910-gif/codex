import { getServerProviderConfig } from "./provider-config";

export function getHunterConfig() {
  return getServerProviderConfig("HUNTER_API_KEY");
}
