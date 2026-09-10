import type { FastifyInstance } from "fastify";
import { assessAddress } from "../services/riskEngine.js";
import type { Address } from "../types.js";

interface AssessBody {
  addresses: string[];
}

export function registerRiskRoutes(app: FastifyInstance) {
  // POST /api/risk/assess — the only endpoint the extension's risk-assessor screen needs.
  app.post<{ Body: AssessBody }>("/api/risk/assess", async (req, reply) => {
    const { addresses } = req.body ?? {};
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return reply.status(400).send({ error: "addresses[] is required" });
    }
    if (addresses.length > 10) {
      return reply.status(400).send({ error: "max 10 addresses per request" });
    }

    try {
      const scores = await Promise.all(addresses.map((a) => assessAddress(a as Address)));
      return { scores };
    } catch (err) {
      req.log.error(err);
      return reply.status(502).send({ error: "risk assessment failed — check upstream data sources" });
    }
  });
}
