import { getServerProviderConfig } from "./provider-config";

export function getContactOutConfig() {
  return getServerProviderConfig("CONTACTOUT_API_KEY");
}
