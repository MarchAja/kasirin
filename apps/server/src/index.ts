import { createApp } from "./app.js";
import { config } from "./config.js";

const app = await createApp({ logger: true });

for (const sinyal of ["SIGINT", "SIGTERM"] as const) {
  process.on(sinyal, async () => {
    app.log.info(`KasirIn menerima ${sinyal}, menutup server...`);
    await app.close();
    process.exit(0);
  });
}

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(
    `KasirIn ${config.versi} siap di http://localhost:${config.port} (data: ${config.dataDir})`,
  );
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
