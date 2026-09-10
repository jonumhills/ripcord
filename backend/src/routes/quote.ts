import type { FastifyInstance } from "fastify";
import { assessAddress } from "../services/riskEngine.js";
import { buildQuote, coverageCapFromUsd } from "../services/quoteEngine.js";
import type { Address } from "../types.js";

interface QuoteBody {
  addresses: string[];
  coverageCapUsd: number; // coverage cap requested per address, in USD (== USDC 1:1 for this demo)
}

export function registerQuoteRoutes(app: FastifyInstance) {
  // POST /api/quote — drives both the extension's quote screen and the website's quote panel.
  app.post<{ Body: QuoteBody }>("/api/quote", async (req, reply) => {
    const { addresses, coverageCapUsd } = req.body ?? {};
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return reply.status(400).send({ error: "addresses[] is required" });
    }
    if (!coverageCapUsd || coverageCapUsd <= 0) {
      return reply.status(400).send({ error: "coverageCapUsd must be > 0" });
    }

    try {
      const scores = await Promise.all(addresses.map((a) => assessAddress(a as Address)));
      const quote = buildQuote(scores, coverageCapFromUsd(coverageCapUsd));
      return { quote, scores };
    } catch (err) {
      req.log.error(err);
      return reply.status(502).send({ error: "quote generation failed — check upstream data sources" });
    }
  });
}
