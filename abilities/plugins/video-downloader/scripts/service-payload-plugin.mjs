import { buildServiceArtifact, readDeclaredDigests, syncManifestDigest } from "./package-service.mjs";

const VIRTUAL_ID = "virtual:service-payload";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

// `vitest` never needs the real bytes: the tests mock this module. Keeping the stub here means
// a test run does not compile the service.
const STUB = "export const SERVICE_PAYLOAD = \"\";\nexport const SERVICE_PAYLOAD_SHA256 = \"\";\n";

/**
 * Inline the compiled service as a lazily loaded chunk.
 *
 * The host installs a runtime from bytes the plugin hands it, and it cannot read files out of
 * the plugin package itself, so the archive has to travel inside the bundle. Building it here
 * (rather than committing a generated file) guarantees the payload always matches the service
 * sources in the same commit; the digest in `plugin.json` is rewritten from the same bytes so a
 * mismatch cannot be shipped.
 */
export function servicePayloadPlugin() {
  let artifact;
  return {
    name: "video-downloader:service-payload",
    enforce: "pre",
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      if (process.env.VITEST) return STUB;
      artifact ??= buildServiceArtifact();
      const declared = readDeclaredDigests();
      if (declared.some((entry) => entry.sha256 !== artifact.sha256)) {
        const count = syncManifestDigest(artifact.sha256);
        this.info(`[service-payload] rewrote ${count} plugin.json digest(s) to ${artifact.sha256}`);
      }
      return `export const SERVICE_PAYLOAD = ${JSON.stringify(artifact.base64)};\nexport const SERVICE_PAYLOAD_SHA256 = ${JSON.stringify(artifact.sha256)};\n`;
    },
  };
}
