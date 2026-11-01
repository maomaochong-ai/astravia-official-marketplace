declare module "virtual:service-payload" {
  /** Base64 of the deterministic service archive, inlined by `scripts/service-payload-plugin.mjs`. */
  export const SERVICE_PAYLOAD: string;
  /** sha256 of those bytes, the same value `plugin.json` declares for every platform. */
  export const SERVICE_PAYLOAD_SHA256: string;
}
