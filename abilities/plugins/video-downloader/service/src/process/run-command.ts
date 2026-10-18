import { spawn } from "node:child_process";

export interface CommandResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface CommandOptions {
  timeoutMs?: number;
  cwd?: string;
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
}

const OUTPUT_LIMIT = 8 * 1024 * 1024;

/**
 * Run a short-lived command to completion and collect its output.
 *
 * Only used for probing and one-off capability checks. Long running downloads are
 * spawned directly by the task runner so their output can be streamed and cancelled.
 */
export function runCommand(command: string, args: string[], options: CommandOptions = {}): Promise<CommandResult> {
  const { timeoutMs = 60_000, cwd, signal, env } = options;
  return new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    const abort = () => child.kill("SIGKILL");
    signal?.addEventListener("abort", abort, { once: true });

    const append = (buffer: Buffer, target: "stdout" | "stderr") => {
      const text = buffer.toString("utf8");
      if (target === "stdout") {
        if (stdout.length < OUTPUT_LIMIT) stdout += text;
      } else if (stderr.length < OUTPUT_LIMIT) {
        stderr += text;
      }
    };

    child.stdout.on("data", (chunk: Buffer) => append(chunk, "stdout"));
    child.stderr.on("data", (chunk: Buffer) => append(chunk, "stderr"));
    child.on("error", (error) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(error);
    });
    child.on("close", (code, exitSignal) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      resolve({ code, signal: exitSignal, stdout, stderr, timedOut });
    });
  });
}
