import { readEnvironment } from "./environment.js";
import { createRouter } from "./http/router.js";
import { ServiceContext } from "./service-context.js";

async function main(): Promise<void> {
  const environment = readEnvironment();
  const context = new ServiceContext(environment);
  await context.initialize();

  const router = createRouter(context);
  const port = await router.listen(environment.port);

  const shutdown = async () => {
    await router.close().catch(() => undefined);
    await context.shutdown().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());

  // The host reads the first `ready:` line to learn the bound port.
  process.stdout.write(`ready:${port}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exit(1);
});
