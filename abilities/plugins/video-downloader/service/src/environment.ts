import { homedir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Runtime directories handed over by the desktop host.
 *
 * `ASTRAVIA_SERVICE_RUNTIME_DIR` is the unpacked service version directory, which is where the
 * host-native entry point is resolved from. The remaining variables are optional so the service can
 * also be started by hand during development.
 */
export interface ServiceEnvironment {
  port: number;
  dataRoot: string;
  runtimeRoot: string;
}

function envPath(name: string): string | undefined {
  const raw = process.env[name]?.trim();
  return raw ? resolve(raw) : undefined;
}

export function readEnvironment(): ServiceEnvironment {
  const port = Number.parseInt(process.env.ASTRAVIA_SERVICE_PORT ?? "0", 10);
  return {
    port: Number.isFinite(port) ? port : 0,
    runtimeRoot: envPath("ASTRAVIA_SERVICE_RUNTIME_DIR") ?? process.cwd(),
    dataRoot: envPath("ASTRAVIA_SERVICE_DATA_DIR") ?? join(process.cwd(), "service-data"),
  };
}

export function defaultDownloadDirectory(): string {
  return join(process.env.ASTRAVIA_DOWNLOADS_DIR?.trim() || homedir(), "Downloads", "Astravia Video");
}
