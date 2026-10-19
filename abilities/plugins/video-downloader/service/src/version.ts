import { createRequire } from "node:module";

/**
 * The service reports its own version in `/health` and in the MCP handshake. Reading it from the
 * packaged `package.json` keeps both in step with a release instead of drifting from a constant.
 */
const require = createRequire(import.meta.url);
const manifest = require("../package.json") as { version?: unknown };

export const SERVICE_VERSION = typeof manifest.version === "string" ? manifest.version : "0.0.0";
