import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerRiskRoutes } from "./routes/risk.js";
import { registerQuoteRoutes } from "./routes/quote.js";
import { registerPolicyRoutes } from "./routes/policy.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerClaimsRoutes } from "./routes/claims.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { startMonitor } from "./monitor/walletMonitor.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
});

registerHealthRoutes(app);
registerRiskRoutes(app);
registerQuoteRoutes(app);
registerPolicyRoutes(app);
registerAuthRoutes(app);
registerClaimsRoutes(app);
registerAdminRoutes(app);

startMonitor();

app
  .listen({ port: config.port, host: "0.0.0.0" })
  .then((address) => app.log.info(`Ripcord backend listening on ${address}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
